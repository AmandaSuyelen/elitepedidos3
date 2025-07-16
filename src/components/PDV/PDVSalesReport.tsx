// Código limpo e retificado para o componente PDVSalesReport
// Todos os conflitos de merge foram resolvidos mantendo a versão mais recente
// com a lógica simplificada de filtro de data usando strings ISO completas

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, Download, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../PermissionGuard';

const PDVSalesReport: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [dateRange, setDateRange] = useState({
    start: (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })(),
    end: new Date().toISOString().split('T')[0]
  });
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const startDate = `${dateRange.start}T00:00:00`;
      const endDate = `${dateRange.end}T23:59:59`;

      const { data: sales, error: salesError } = await supabase
        .from('pdv_sales')
        .select('*, pdv_sale_items(*)')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('is_cancelled', false);

      if (salesError) throw salesError;

      const totalSales = sales?.length || 0;
      const totalAmount = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const avgTicket = totalSales > 0 ? totalAmount / totalSales : 0;

      const productStats: Record<string, { quantity: number; revenue: number }> = {};
      sales?.forEach(sale => {
        sale.pdv_sale_items?.forEach((item: any) => {
          if (!productStats[item.product_name]) {
            productStats[item.product_name] = { quantity: 0, revenue: 0 };
          }
          productStats[item.product_name].quantity += item.quantity;
          productStats[item.product_name].revenue += item.subtotal;
        });
      });

      const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({
          product_name: name,
          quantity: stats.quantity,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setReport({
        date: `${dateRange.start} a ${dateRange.end}`,
        total_sales: totalSales,
        total_amount: totalAmount,
        avg_ticket: avgTicket,
        top_products: topProducts
      });
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const exportToCSV = () => {
    if (!report) return;

    const csvContent = [
      ['Relatório de Vendas PDV'],
      ['Período', report.date],
      [''],
      ['Resumo'],
      ['Total de Vendas', report.total_sales.toString()],
      ['Faturamento Total', formatPrice(report.total_amount)],
      ['Ticket Médio', formatPrice(report.avg_ticket)],
      [''],
      ['Produtos Mais Vendidos'],
      ['Produto', 'Quantidade', 'Faturamento'],
      ...report.top_products.map(p => [p.product_name, p.quantity.toString(), formatPrice(p.revenue)])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pdv-${dateRange.start}-${dateRange.end}.csv`;
    link.click();
  };

  const debugDateFiltering = () => {
    const startDate = `${dateRange.start}T00:00:00`;
    const endDate = `${dateRange.end}T23:59:59`;
    console.log('🔍 Depuração de datas:');
    console.log(`Data inicial: ${startDate}`);
    console.log(`Data final:   ${endDate}`);
  };

  useEffect(() => {
    generateReport();
  }, []);

  return (
    <PermissionGuard hasPermission={hasPermission('can_view_sales_report')} showMessage={true}>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 size={24} className="text-purple-600" />
              Relatórios de Vendas
            </h2>
            <p className="text-gray-600">Análise de performance do PDV</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={generateReport}
                disabled={loading}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? 'Gerando...' : (<><Calendar size={16} /> Gerar Relatório</>)}
              </button>

              {report && (
                <>
                  <button
                    onClick={exportToCSV}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Download size={16} /> Exportar
                  </button>
                  <button
                    onClick={debugDateFiltering}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    Debug
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Relatório */}
        {report && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Package size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total de Vendas</p>
                    <p className="text-2xl font-bold text-gray-800">{report.total_sales}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 rounded-full p-3">
                    <DollarSign size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Faturamento Total</p>
                    <p className="text-2xl font-bold text-gray-800">{formatPrice(report.total_amount)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 rounded-full p-3">
                    <TrendingUp size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ticket Médio</p>
                    <p className="text-2xl font-bold text-gray-800">{formatPrice(report.avg_ticket)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Produtos Mais Vendidos */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Produtos Mais Vendidos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-6 font-medium text-gray-700">Posição</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-700">Produto</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-700">Quantidade</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-700">Faturamento</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-700">% do Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {report.top_products.map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              index === 0 ? 'bg-yellow-500' :
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-orange-500' :
                              'bg-gray-300'}`}>{index + 1}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-800">{product.product_name}</td>
                        <td className="py-4 px-6 text-gray-700">{product.quantity}</td>
                        <td className="py-4 px-6 font-semibold text-green-600">{formatPrice(product.revenue)}</td>
                        <td className="py-4 px-6 text-gray-700">
                          {((product.revenue / report.total_amount) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  );
};

export default PDVSalesReport;