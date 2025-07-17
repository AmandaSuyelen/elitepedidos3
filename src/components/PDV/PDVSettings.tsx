import React, { useState, useEffect } from 'react';
import { Settings, Calendar, Clock, Tag, Store, DollarSign, Printer, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../PermissionGuard';
import { useStoreHours } from '../../hooks/useStoreHours';
import { StoreHours } from '../../types/store';
import ProductScheduleModal from '../Admin/ProductScheduleModal';
import { products } from '../../data/products';
import { useProductScheduling } from '../../hooks/useProductScheduling';

const PDVSettings: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { storeHours, storeSettings, updateStoreHours, updateStoreSettings, getStoreStatus } = useStoreHours();
  const { getProductSchedule, saveProductSchedule } = useProductScheduling();
  
  const [activeTab, setActiveTab] = useState<'store' | 'delivery' | 'promotions' | 'printer'>('store');
  const [localHours, setLocalHours] = useState<Record<number, Partial<StoreHours>>>({});
  const [localSettings, setLocalSettings] = useState({
    store_name: '',
    phone: '',
    cnpj: '',
    address: '',
    delivery_fee: 0,
    min_order_value: 0,
    estimated_delivery_time: 0,
    is_open_now: true
  });
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedProductForSchedule, setSelectedProductForSchedule] = useState<any | null>(null);
  const [printerSettings, setPrinterSettings] = useState({
    paper_width: '80mm',
    page_size: 300,
    font_size: 2,
    delivery_font_size: 14,
    scale: 1,
    margin_left: 0,
    margin_top: 1,
    margin_bottom: 1
  });

  // Inicializar configurações locais quando os dados carregarem
  useEffect(() => {
    if (storeSettings) {
      setLocalSettings({
        store_name: storeSettings.store_name || '',
        phone: storeSettings.phone || '',
        cnpj: storeSettings.cnpj || '',
        address: storeSettings.address || '',
        delivery_fee: storeSettings.delivery_fee || 0,
        min_order_value: storeSettings.min_order_value || 0,
        estimated_delivery_time: storeSettings.estimated_delivery_time || 0,
        is_open_now: storeSettings.is_open_now ?? true
      });
    }
  }, [storeSettings]);

  // Carregar configurações de impressora do localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pdv_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.printer_layout) {
          setPrinterSettings(settings.printer_layout);
        }
      } catch (e) {
        console.error('Erro ao carregar configurações de impressora:', e);
      }
    }
  }, []);

  // Limpar alterações locais quando os dados do servidor mudarem
  useEffect(() => {
    setLocalHours({});
  }, [storeHours]);

  const getHoursForDay = (dayOfWeek: number) => {
    const localHour = localHours[dayOfWeek];
    const originalHour = storeHours.find(h => h.day_of_week === dayOfWeek);
    
    return {
      is_open: localHour?.is_open ?? originalHour?.is_open ?? true,
      open_time: localHour?.open_time ?? originalHour?.open_time ?? '08:00',
      close_time: localHour?.close_time ?? originalHour?.close_time ?? '22:00'
    };
  };

  const updateLocalHours = (dayOfWeek: number, field: keyof StoreHours, value: any) => {
    setLocalHours(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value
      }
    }));
  };

  const handleSaveHours = async () => {
    setSaving(true);
    try {
      // Salvar horários modificados
      const savePromises = [];
      
      for (const [dayStr, hours] of Object.entries(localHours)) {
        const day = parseInt(dayStr);
        savePromises.push(updateStoreHours(day, hours));
      }

      // Salvar configurações da loja
      savePromises.push(updateStoreSettings(localSettings));

      await Promise.all(savePromises);

      // Limpar alterações locais
      setLocalHours({});
      
      setLastSaved(new Date());
      
      // Mostrar feedback de sucesso
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
      successMessage.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Configurações salvas com sucesso!
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrinterSettings = () => {
    try {
      // Save printer settings to localStorage
      const currentSettings = localStorage.getItem('pdv_settings');
      const settings = currentSettings ? JSON.parse(currentSettings) : {};
      
      settings.printer_layout = printerSettings;
      localStorage.setItem('pdv_settings', JSON.stringify(settings));
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
      successMessage.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Configurações de impressora salvas com sucesso!
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Erro ao salvar configurações de impressora:', error);
      alert('Erro ao salvar configurações de impressora. Tente novamente.');
    }
  };

  const handleScheduleProduct = (product: any) => {
    setSelectedProductForSchedule(product);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (productId: string, scheduledDays: any) => {
    try {
      await saveProductSchedule(productId, scheduledDays);
      setShowScheduleModal(false);
      setSelectedProductForSchedule(null);
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
      successMessage.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Programação do produto salva com sucesso!
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
    } catch (error) {
      console.error('Erro ao salvar programação:', error);
      alert('Erro ao salvar programação. Tente novamente.');
    }
  };

  const dayNames = [
    'Domingo',
    'Segunda-feira', 
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  const hasChanges = Object.keys(localHours).length > 0 || 
    JSON.stringify(localSettings) !== JSON.stringify({
      store_name: storeSettings?.store_name || '',
      phone: storeSettings?.phone || '',
      cnpj: storeSettings?.cnpj || '',
      address: storeSettings?.address || '',
      delivery_fee: storeSettings?.delivery_fee || 0,
      min_order_value: storeSettings?.min_order_value || 0,
      estimated_delivery_time: storeSettings?.estimated_delivery_time || 0,
      is_open_now: storeSettings?.is_open_now ?? true
    });

  return (
    <PermissionGuard hasPermission={hasPermission('can_manage_products')} showMessage={true}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={24} className="text-gray-600" />
              Configurações do Sistema
            </h2>
            <p className="text-gray-600">Personalize o funcionamento do PDV e Delivery</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('store')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'store'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Store size={18} />
              Loja
            </button>
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'delivery'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock size={18} />
              Horários de Funcionamento
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'promotions'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Tag size={18} />
              Promoções
            </button>
            <button
              onClick={() => setActiveTab('printer')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'printer'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Printer size={18} />
              Impressora
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'store' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Store size={20} className="text-blue-600" />
              Informações da Loja
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Loja
                </label>
                <input
                  type="text"
                  value={localSettings.store_name}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, store_name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome da sua loja"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={localSettings.phone}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(85) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={localSettings.cnpj || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, cnpj: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={localSettings.address}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Endereço completo da loja"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taxa de Entrega (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={localSettings.delivery_fee}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, delivery_fee: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pedido Mínimo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={localSettings.min_order_value}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, min_order_value: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="15.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tempo de Entrega (minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  value={localSettings.estimated_delivery_time}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, estimated_delivery_time: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="35"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 mb-2">
                  <span className="text-gray-700 font-medium">Controle Manual:</span>
                </label>
                <button
                  onClick={() => setLocalSettings(prev => ({ ...prev, is_open_now: !prev.is_open_now }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    localSettings.is_open_now
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {localSettings.is_open_now ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Loja Aberta
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Loja Fechada
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Sobrescreve os horários automáticos
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveHours}
                disabled={saving || !hasChanges}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Salvar Configurações
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-green-600" />
              Horários de Funcionamento
            </h3>

            <div className="space-y-4">
              {dayNames.map((dayName, index) => {
                const hours = getHoursForDay(index);
                const hasLocalChanges = localHours[index];
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${
                    hasLocalChanges ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-800 flex items-center gap-2">
                        {dayName}
                        {hasLocalChanges && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                            Modificado
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={() => updateLocalHours(index, 'is_open', !hours.is_open)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                          hours.is_open
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {hours.is_open ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Aberto
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Fechado
                          </>
                        )}
                      </button>
                    </div>

                    {hours.is_open && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Abertura</label>
                          <input
                            type="time"
                            value={hours.open_time}
                            onChange={(e) => updateLocalHours(index, 'open_time', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Fechamento</label>
                          <input
                            type="time"
                            value={hours.close_time}
                            onChange={(e) => updateLocalHours(index, 'close_time', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveHours}
                disabled={saving || !hasChanges}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Salvar Horários
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Tag size={20} className="text-orange-600" />
              Programação de Promoções
            </h3>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Programação de Promoções</p>
                  <p className="text-orange-700 text-sm mt-1">
                    Configure os dias e horários em que cada promoção estará disponível.
                    As promoções só aparecerão no cardápio nos dias programados.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-800">Produtos com Promoções</h4>
                <div className="text-sm text-gray-500">
                  {products.filter(p => p.originalPrice && p.originalPrice > p.price).length} produtos com desconto
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Normal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Promocional</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Programação</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products
                      .filter(p => p.originalPrice && p.originalPrice > p.price)
                      .map(product => {
                        const schedule = getProductSchedule(product.id);
                        const hasSchedule = schedule?.enabled;
                        const selectedDays = schedule?.days ? 
                          Object.entries(schedule.days)
                            .filter(([_, enabled]) => enabled)
                            .map(([day]) => {
                              const dayMap: Record<string, string> = {
                                'monday': 'Segunda',
                                'tuesday': 'Terça',
                                'wednesday': 'Quarta',
                                'thursday': 'Quinta',
                                'friday': 'Sexta',
                                'saturday': 'Sábado',
                                'sunday': 'Domingo'
                              };
                              return dayMap[day] || day;
                            })
                            .join(', ') : 'Todos os dias';
                            
                        return (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <img className="h-10 w-10 rounded-full object-cover" src={product.image} alt={product.name} />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                  <div className="text-sm text-gray-500">{product.category}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.originalPrice || 0)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-green-600 font-semibold">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className={`text-sm ${hasSchedule ? 'text-green-600' : 'text-gray-500'}`}>
                                {hasSchedule ? selectedDays : 'Não programado'}
                              </div>
                              {hasSchedule && schedule?.startTime && schedule?.endTime && (
                                <div className="text-xs text-gray-500">
                                  {schedule.startTime} - {schedule.endTime}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleScheduleProduct(product)}
                                className="text-orange-600 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-3 py-1 rounded-lg transition-colors"
                              >
                                {hasSchedule ? 'Editar Programação' : 'Programar Dias'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {products.filter(p => p.originalPrice && p.originalPrice > p.price).length === 0 && (
                <div className="text-center py-8">
                  <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhum produto com promoção configurada</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Configure promoções na seção de Produtos
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'printer' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Printer size={20} className="text-purple-600" />
              Configurações de Impressora
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Largura do Papel
                </label>
                <select
                  value={printerSettings.paper_width}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, paper_width: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm (Padrão)</option>
                  <option value="A4">A4</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamanho da Fonte
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={printerSettings.font_size}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, font_size: parseFloat(e.target.value) || 2 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={printerSettings.auto_print_delivery || false}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, auto_print_delivery: e.target.checked }))}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Imprimir pedidos de delivery automaticamente
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Imprime automaticamente quando novos pedidos chegarem
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escala
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={printerSettings.scale}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, scale: parseFloat(e.target.value) || 1 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margem Esquerda (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={printerSettings.margin_left}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, margin_left: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margem Superior (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={printerSettings.margin_top}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, margin_top: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margem Inferior (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={printerSettings.margin_bottom}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, margin_bottom: parseInt(e.target.value) || 0 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSavePrinterSettings}
                className="px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white"
              >
                <Save size={20} />
                Salvar Configurações de Impressora
              </button>
            </div>
          </div>
        )}

        {/* Product Schedule Modal */}
        {showScheduleModal && selectedProductForSchedule && (
          <ProductScheduleModal
            product={selectedProductForSchedule}
            isOpen={showScheduleModal}
            onClose={() => {
              setShowScheduleModal(false);
              setSelectedProductForSchedule(null);
            }}
            onSave={handleSaveSchedule}
            currentSchedule={getProductSchedule(selectedProductForSchedule.id)}
          />
        )}
      </div>
    </PermissionGuard>
  );
};

export default PDVSettings;