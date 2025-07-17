import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../PermissionGuard';
import { 
  Truck, Calendar, Clock, Printer, Download, 
  ArrowDownCircle, ArrowUpCircle, RefreshCw, 
  ShoppingCart, Filter, Search, PieChart,
  User, CreditCard, FileText, ChevronDown, ChevronUp,
  DollarSign
} from 'lucide-react';

interface DeliveryOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_neighborhood: string;
  payment_method: string;
  delivery_fee: number;
  total_price: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DeliverySummary {
  date: string;
  delivery_fees_total: number;
  orders: {
    total: number;
    count: number;
    by_status: Record<string, { total: number; count: number }>;
    by_payment: Record<string, { total: number; count: number }>;
    by_neighborhood: Record<string, { total: number; count: number }>;
  };
}

const PDVDailyDeliveryReport: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    byStatus: true,
    byPayment: true,
    byNeighborhood: true
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDailyReport();
  }, [date]);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      // Get orders for the selected date
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);

      // Calculate summary
      const byStatus: Record<string, { total: number; count: number }> = {};
      const byPayment: Record<string, { total: number; count: number }> = {};
      const byNeighborhood: Record<string, { total: number; count: number }> = {};
      let deliveryFeesTotal = 0;

      (ordersData || []).forEach(order => {
        // Sum delivery fees
        deliveryFeesTotal += order.delivery_fee || 0;
        
        // By status
        if (!byStatus[order.status]) {
          byStatus[order.status] = { total: 0, count: 0 };
        }
        byStatus[order.status].total += order.total_price;
        byStatus[order.status].count += 1;

        // By payment method
        if (!byPayment[order.payment_method]) {
          byPayment[order.payment_method] = { total: 0, count: 0 };
        }
        byPayment[order.payment_method].total += order.total_price;
        byPayment[order.payment_method].count += 1;

        // By neighborhood
        if (!byNeighborhood[order.customer_neighborhood]) {
          byNeighborhood[order.customer_neighborhood] = { total: 0, count: 0 };
        }
        byNeighborhood[order.customer_neighborhood].total += order.total_price;
        byNeighborhood[order.customer_neighborhood].count += 1;
      });

      const summaryData: DeliverySummary = {
        date,
        orders: {
          total: (ordersData || []).reduce((sum, order) => sum + order.total_price, 0),
          count: (ordersData || []).length,
          by_status: byStatus,
          by_payment: byPayment,
          by_neighborhood: byNeighborhood
        },
        delivery_fees_total: deliveryFeesTotal
      };

      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching daily report:', error);
      alert('Erro ao carregar relatório diário');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  const handleExport = () => {
    if (!summary) return;

    // Create CSV content
    const headers = ['ID', 'Cliente', 'Telefone', 'Endereço', 'Bairro', 'Pagamento', 'Total', 'Status', 'Data/Hora'];
    const rows = orders
      .filter(filterOrders)
      .map(order => [
        order.id.slice(-8),
        order.customer_name,
        order.customer_phone,
        order.customer_address,
        order.customer_neighborhood,
        getPaymentMethodLabel(order.payment_method),
        formatPrice(order.total_price),
        getStatusLabel(order.status),
        formatDateTime(order.created_at)
      ]);
    
    const summaryRows = [
      ['', '', '', '', '', '', '', '', ''],
      ['RESUMO DO DELIVERY', '', '', '', '', '', '', '', ''],
      ['Total de Pedidos', summary.orders.count.toString(), '', '', '', '', '', '', ''],
      ['Valor Total', formatPrice(summary.orders.total), '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['POR STATUS', '', '', '', '', '', '', '', ''],
      ...Object.entries(summary.orders.by_status).map(([status, data]) => 
        [getStatusLabel(status), data.count.toString(), formatPrice(data.total), '', '', '', '', '', '']
      ),
      ['', '', '', '', '', '', '', '', ''],
      ['POR FORMA DE PAGAMENTO', '', '', '', '', '', '', '', ''],
      ...Object.entries(summary.orders.by_payment).map(([payment, data]) => 
        [getPaymentMethodLabel(payment), data.count.toString(), formatPrice(data.total), '', '', '', '', '', '']
      )
    ];
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      ...summaryRows.map(row => row.join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-delivery-${date}.csv`;
    link.click();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'money': 'Dinheiro',
      'pix': 'PIX',
      'card': 'Cartão'
    };
    return labels[method] || method;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'confirmed': 'Confirmado',
      'preparing': 'Em Preparo',
      'out_for_delivery': 'Saiu para Entrega',
      'ready_for_pickup': 'Pronto para Retirada',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'text-yellow-600',
      'confirmed': 'text-blue-600',
      'preparing': 'text-orange-600',
      'out_for_delivery': 'text-purple-600',
      'ready_for_pickup': 'text-indigo-600',
      'delivered': 'text-green-600',
      'cancelled': 'text-red-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filterOrders = (order: DeliveryOrder) => {
    // Filter by status
    if (filterStatus !== 'all' && order.status !== filterStatus) {
      return false;
    }
    
    // Filter by payment method
    if (filterPayment !== 'all' && order.payment_method !== filterPayment) {
      return false;
    }
    
    // Filter by neighborhood
    if (filterNeighborhood !== 'all' && order.customer_neighborhood !== filterNeighborhood) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm && !order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !order.customer_phone.includes(searchTerm) &&
        !order.id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  };

  const filteredOrders = orders.filter(filterOrders);

  return (
    <PermissionGuard hasPermission={hasPermission('can_view_orders')} showMessage={true}>
      <div className={`space-y-6 ${printMode ? 'print:bg-white print:p-0' : ''}`}>
        {/* Header - Hide in print mode */}
        {!printMode && (
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Truck size={24} className="text-purple-600" />
                Relatório de Delivery Diário
              </h2>
              <p className="text-gray-600">Resumo completo dos pedidos de delivery do dia</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Printer size={16} />
                Imprimir
              </button>
              <button
                onClick={handleExport}
                disabled={!summary}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
          </div>
        )}

      {/* Print Header - Only show in print mode */}
      {printMode && (
        <div className="print-header">
          <h1 className="text-2xl font-bold text-center">Relatório de Delivery Diário - Elite Açaí</h1>
          <p className="text-center text-gray-600">
            Data: {new Date(date).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-center text-gray-500 text-sm">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          <hr className="my-4" />
        </div>
      )}

      {/* Date Selector - Hide in print mode */}
      {!printMode && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data do Relatório
              </label>
              <div className="relative">
                <Calendar size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="w-full md:w-auto">
              <button
                onClick={fetchDailyReport}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Carregando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Atualizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : !summary ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Truck size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Nenhum pedido de delivery encontrado
          </h3>
          <p className="text-gray-500">
            Não há pedidos de delivery para a data selecionada.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-100 rounded-full p-3">
                  <Truck size={24} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Total de Pedidos</h3>
                  <p className="text-3xl font-bold text-purple-600">{summary.orders.count}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Data: {new Date(date).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <DollarSign size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Total de Taxas</h3>
                  <p className="text-3xl font-bold text-blue-600">{formatPrice(summary.delivery_fees_total)}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Taxa média: {formatPrice(summary.orders.count > 0 ? summary.delivery_fees_total / summary.orders.count : 0)}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 rounded-full p-3">
                  <ArrowDownCircle size={24} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Faturamento Total</h3>
                  <p className="text-3xl font-bold text-green-600">{formatPrice(summary.orders.total)}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Ticket Médio: {formatPrice(summary.orders.count > 0 ? summary.orders.total / summary.orders.count : 0)}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <Clock size={24} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Status dos Pedidos</h3>
                  <div className="flex gap-2 mt-2">
                    {Object.entries(summary.orders.by_status).map(([status, data]) => (
                      <div 
                        key={status}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'delivered' ? 'bg-green-100 text-green-800' :
                          status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {getStatusLabel(status)}: {data.count}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters - Hide in print mode */}
          {!printMode && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Filter size={20} className="text-gray-600" />
                  Filtros
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Todos os status</option>
                    {Object.entries(summary.orders.by_status).map(([status, _]) => (
                      <option key={status} value={status}>{getStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Todas as formas</option>
                    {Object.entries(summary.orders.by_payment).map(([payment, _]) => (
                      <option key={payment} value={payment}>{getPaymentMethodLabel(payment)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bairro
                  </label>
                  <select
                    value={filterNeighborhood}
                    onChange={(e) => setFilterNeighborhood(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Todos os bairros</option>
                    {Object.entries(summary.orders.by_neighborhood).map(([neighborhood, _]) => (
                      <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Busca
                  </label>
                  <div className="relative">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nome, telefone ou ID"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Lista de Pedidos</h3>
              <p className="text-sm text-gray-600">
                {filteredOrders.length} pedido(s) encontrado(s)
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Bairro</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Pagamento</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Data/Hora</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Taxa</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-gray-500">
                        Nenhum pedido encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">#{order.id.slice(-8)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-800">{order.customer_name}</p>
                            <p className="text-sm text-gray-600">{order.customer_phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{order.customer_neighborhood}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{getPaymentMethodLabel(order.payment_method)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            order.status === 'out_for_delivery' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                            order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{formatDateTime(order.created_at)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium text-blue-600">{formatPrice(order.delivery_fee || 0)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-green-600">{formatPrice(order.total_price)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* By Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('byStatus')}
              >
                <h3 className="text-lg font-semibold text-gray-800">Por Status</h3>
                {expandedSections.byStatus ? 
                  <ChevronUp size={20} className="text-gray-500" /> : 
                  <ChevronDown size={20} className="text-gray-500" />}
              </div>
              
              {expandedSections.byStatus && (
                <div className="space-y-4">
                  {Object.entries(summary.orders.by_status).map(([status, data]) => (
                    <div key={status} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          status === 'delivered' ? 'bg-green-500' :
                          status === 'cancelled' ? 'bg-red-500' :
                          status === 'out_for_delivery' ? 'bg-purple-500' :
                          status === 'preparing' ? 'bg-orange-500' :
                          status === 'confirmed' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}></span>
                        <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{data.count} pedidos</p>
                        <p className="text-xs text-gray-600">{formatPrice(data.total)}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <div className="text-right space-y-1">
                        <p className="font-medium text-gray-800">{summary.orders.count} pedidos</p>
                        <p className="font-medium text-blue-600">Taxas: {formatPrice(summary.delivery_fees_total)}</p>
                        <p className="font-medium text-green-600">Total: {formatPrice(summary.orders.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* By Payment Method */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('byPayment')}
              >
                <h3 className="text-lg font-semibold text-gray-800">Por Forma de Pagamento</h3>
                {expandedSections.byPayment ? 
                  <ChevronUp size={20} className="text-gray-500" /> : 
                  <ChevronDown size={20} className="text-gray-500" />}
              </div>
              
              {expandedSections.byPayment && (
                <div className="space-y-4">
                  {Object.entries(summary.orders.by_payment).map(([payment, data]) => (
                    <div key={payment} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          payment === 'money' ? 'bg-green-500' :
                          payment === 'pix' ? 'bg-blue-500' :
                          'bg-purple-500'
                        }`}></span>
                        <span className="text-sm font-medium">{getPaymentMethodLabel(payment)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{data.count} pedidos</p>
                        <p className="text-xs text-gray-600">{formatPrice(data.total)}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <div className="text-right space-y-1">
                        <p className="font-medium text-gray-800">{summary.orders.count} pedidos</p>
                        <p className="font-medium text-blue-600">Taxas: {formatPrice(summary.delivery_fees_total)}</p>
                        <p className="font-medium text-green-600">Total: {formatPrice(summary.orders.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* By Neighborhood */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('byNeighborhood')}
              >
                <h3 className="text-lg font-semibold text-gray-800">Por Bairro</h3>
                {expandedSections.byNeighborhood ? 
                  <ChevronUp size={20} className="text-gray-500" /> : 
                  <ChevronDown size={20} className="text-gray-500" />}
              </div>
              
              {expandedSections.byNeighborhood && (
                <div className="space-y-4">
                  {Object.entries(summary.orders.by_neighborhood)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([neighborhood, data]) => (
                      <div key={neighborhood} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                          <span className="text-sm font-medium">{neighborhood}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{data.count} pedidos</p>
                          <p className="text-xs text-gray-600">{formatPrice(data.total)}</p>
                        </div>
                      </div>
                    ))}
                  
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <div className="text-right space-y-1">
                        <p className="font-medium text-gray-800">{summary.orders.count} pedidos</p>
                        <p className="font-medium text-blue-600">Taxas: {formatPrice(summary.delivery_fees_total)}</p>
                        <p className="font-medium text-green-600">Total: {formatPrice(summary.orders.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          
          body {
            font-family: Arial, sans-serif;
            color: #000;
            background: #fff;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          
          th {
            background-color: #f2f2f2;
          }
          
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .print-header h1 {
            font-size: 24px;
            margin-bottom: 5px;
          }
          
          .print-header p {
            font-size: 14px;
            color: #666;
          }
        }
      `}</style>
    </div>
    </PermissionGuard>
  );
};

export default PDVDailyDeliveryReport;