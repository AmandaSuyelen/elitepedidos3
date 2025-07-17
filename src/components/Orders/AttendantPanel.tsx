import React, { useState, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../PermissionGuard';
import OrderPrintView from './OrderPrintView';
import OrderCard from './OrderCard';
import ManualOrderForm from './ManualOrderForm';
import { OrderStatus } from '../../types/order';
import { 
  Filter, 
  Search, 
  Bell, 
  Package, 
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ArrowLeft,
  Settings,
  Plus
} from 'lucide-react';

interface AttendantPanelProps {
  onBackToAdmin?: () => void;
}

const AttendantPanel: React.FC<AttendantPanelProps> = ({ onBackToAdmin }) => {
  const { hasPermission } = usePermissions();
  const { orders, loading, updateOrderStatus } = useOrders();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showManualOrderForm, setShowManualOrderForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [newOrder, setNewOrder] = useState<any | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Carregar configuração de som
  useEffect(() => {
    try {
      const soundSettings = localStorage.getItem('orderSoundSettings');
      if (soundSettings) {
        const settings = JSON.parse(soundSettings);
        setSoundEnabled(settings.enabled);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de som:', error);
    }
  }, []);

  // Carregar configurações de impressora
  const [printerSettings, setPrinterSettings] = useState({
    auto_print_delivery: false
  });
  
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('pdv_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.printer_layout) {
          setPrinterSettings({
            auto_print_delivery: settings.printer_layout.auto_print_delivery || false
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de impressora:', error);
    }
  }, []);

  // Alternar som de notificação
  const toggleSound = () => {
    try {
      const newState = !soundEnabled;
      setSoundEnabled(newState);
      
      // Salvar no localStorage
      const soundSettings = localStorage.getItem('orderSoundSettings');
      const settings = soundSettings ? JSON.parse(soundSettings) : { volume: 0.7, soundUrl: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" };
      settings.enabled = newState;
      localStorage.setItem('orderSoundSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Erro ao salvar configurações de som:', error);
    }
  };

  // Efeito para tocar som quando novos pedidos chegarem
  useEffect(() => {
    // Contar pedidos pendentes
    const currentPendingCount = orders.filter(order => order.status === 'pending').length;
    setPendingOrdersCount(currentPendingCount);
    
    // Verificar se há novos pedidos
    if (currentPendingCount > lastOrderCount && lastOrderCount > 0) {
      console.log('🔔 Novos pedidos detectados!');
      
      // Encontrar o novo pedido
      const newOrders = orders.filter(order => 
        order.status === 'pending' && 
        !orders.some(o => o.id === order.id && o.status !== 'pending')
      );
      
      if (newOrders.length > 0) {
        // Pegar o pedido mais recente
        const latestOrder = newOrders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        setNewOrder(latestOrder);
        
        // Imprimir automaticamente se configurado
        if (printerSettings.auto_print_delivery) {
          console.log('🖨️ Imprimindo pedido automaticamente:', latestOrder.id);
          setShowPrintPreview(true);
        }
      }
      
      // Verificar se o som está habilitado
      if (soundEnabled) {
        playNewOrderSound();
      } else {
        console.log('🔕 Som de notificação desabilitado nas configurações');
      }
    }
    
    // Se já tínhamos contagem anterior e agora temos mais pedidos pendentes, tocar som
    if (lastOrderCount > 0 && currentPendingCount > lastOrderCount) {
      console.log('🔔 Novos pedidos detectados!');
      
      // Verificar se o som está habilitado
      if (soundEnabled) {
        playNewOrderSound();
      } else {
        console.log('🔕 Som de notificação desabilitado nas configurações');
      }
    }
    
    // Atualizar contagem para próxima verificação
    setLastOrderCount(currentPendingCount);
  }, [orders]);

  // Função para tocar som de novo pedido
  const playNewOrderSound = () => {
    console.log('🔊 Tocando som de notificação para novo pedido');
    try {
      // Obter configuração de som do localStorage
      const soundSettings = localStorage.getItem('orderSoundSettings');
      const settings = soundSettings ? JSON.parse(soundSettings) : { enabled: true, volume: 0.7, soundUrl: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" };
      
      // Verificar se o som está habilitado
      if (!settings.enabled) {
        console.log('🔕 Som de notificação desabilitado nas configurações');
        return;
      }
      
      // Criar um elemento de áudio e tocar o som configurado
      const audio = new Audio(settings.soundUrl);
      audio.volume = settings.volume; // Ajustar volume conforme configuração
      audio.play().catch(e => {
        console.error('Erro ao tocar som de notificação:', e);
        // Tentar método alternativo se falhar
        playFallbackSound();
      });
      
      // Mostrar notificação visual também, se suportado pelo navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Novo Pedido!', {
          body: 'Um novo pedido está aguardando atendimento.',
          icon: '/vite.svg'
        });
      }
    } catch (error) {
      console.error('Erro ao tocar som de notificação:', error);
      // Tentar método alternativo se falhar
      playFallbackSound();
    }
  };
  
  // Método alternativo para tocar som
  const playFallbackSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Criar sequência de sons para chamar mais atenção
      const playTone = (freq: number, time: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + duration);
        
        oscillator.start(audioContext.currentTime + time);
        oscillator.stop(audioContext.currentTime + time + duration);
      };
      
      // Tocar sequência de notas (como uma campainha)
      playTone(1200, 0, 0.2);
      playTone(900, 0.3, 0.2);
      playTone(1200, 0.6, 0.3);
    } catch (error) {
      console.error('Erro ao tocar som de fallback:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone.includes(searchTerm);
    
    return matchesStatus && matchesSearch;
  });

  const getStatusCount = (status: OrderStatus) => {
    return orders.filter(order => order.status === status).length;
  };

  const statusOptions = [
    { value: 'all' as const, label: 'Todos', count: orders.length, icon: Package },
    { value: 'pending' as const, label: 'Pendentes', count: getStatusCount('pending'), icon: Clock },
    { value: 'confirmed' as const, label: 'Confirmados', count: getStatusCount('confirmed'), icon: CheckCircle },
    { value: 'preparing' as const, label: 'Em Preparo', count: getStatusCount('preparing'), icon: Package },
    { value: 'out_for_delivery' as const, label: 'Saiu p/ Entrega', count: getStatusCount('out_for_delivery'), icon: Truck },
    { value: 'ready_for_pickup' as const, label: 'Pronto p/ Retirada', count: getStatusCount('ready_for_pickup'), icon: Package },
    { value: 'delivered' as const, label: 'Entregues', count: getStatusCount('delivered'), icon: CheckCircle },
    { value: 'cancelled' as const, label: 'Cancelados', count: getStatusCount('cancelled'), icon: XCircle }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard hasPermission={hasPermission('can_view_orders')} showMessage={true}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {onBackToAdmin && (
                  <button
                    onClick={onBackToAdmin}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Voltar ao painel administrativo"
                  >
                    <ArrowLeft size={20} className="text-gray-600" />
                  </button>
                )}
                <div className="bg-purple-100 rounded-full p-2">
                  <Package size={24} className="text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Painel de Atendimento</h1>
                  <p className="text-gray-600">Gerencie pedidos e converse com clientes</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSound}
                  className={`p-2 rounded-full transition-colors ${soundEnabled ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={soundEnabled ? "Desativar som de notificações" : "Ativar som de notificações"}
                >
                  {soundEnabled ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.343 9.657a2 2 0 000 2.828l1.414 1.414a4 4 0 01-1.414 1.414l-1.414-1.414a2 2 0 00-2.828 0L2.1 14.9a2 2 0 000 2.828l1.414 1.414a2 2 0 002.828 0l1.414-1.414a4 4 0 011.414-1.414l-1.414-1.414a2 2 0 000-2.828L6.343 9.657z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15.414a2 2 0 002.828 0l1.414-1.414a4 4 0 011.414-1.414l-1.414-1.414a2 2 0 000-2.828L6.343 9.657a2 2 0 00-2.828 0L2.1 14.9a2 2 0 000 2.828l1.414 1.414a2 2 0 002.828 0l1.414-1.414a4 4 0 011.414-1.414l-1.414-1.414a2 2 0 000-2.828L6.343 9.657z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowManualOrderForm(true)}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  <Plus size={16} />
                  Pedido Manual
                </button>
                <div className="relative">
                  <Bell size={20} className="text-gray-600" />
                  {orders.filter(o => o.status === 'pending').length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {pendingOrdersCount}
                    </span>
                  )}
                </div>
                {onBackToAdmin && (
                  <button
                    onClick={onBackToAdmin}
                    className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                  >
                    <Settings size={16} />
                    Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, telefone ou ID do pedido..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="lg:w-64">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
            {statusOptions.map(option => {
              const Icon = option.icon;
              const isActive = statusFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} className="mx-auto mb-1" />
                  <div className="text-xs font-medium">{option.label}</div>
                  <div className="text-lg font-bold">{option.count}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                Nenhum pedido encontrado
              </h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Aguardando novos pedidos...'
                }
              </p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                isAttendant={true}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Manual Order Form */}
      {showManualOrderForm && (
        <ManualOrderForm 
          onClose={() => setShowManualOrderForm(false)}
          onOrderCreated={() => {
            // Refresh orders after creating a new one
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }}
        />
      )}
      
      {/* Print Preview Modal */}
      {showPrintPreview && newOrder && (
        <OrderPrintView 
          order={newOrder} 
          storeSettings={null}
          onClose={() => {
            setShowPrintPreview(false);
            setNewOrder(null);
          }} 
        />
      )}
    </div>
    </PermissionGuard>
  );
};

export default AttendantPanel;