import React, { useState, useEffect } from 'react';
import {
  BarChart3, Calendar, Download, Printer, RefreshCw,
  ShoppingCart, Truck, DollarSign
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../PermissionGuard';

interface SalesSummary {
  pdv_sales: {
    count: number;
    total: number;
    by_payment_method: Record<string, { count: number; total: number }>;
  };
  delivery_sales: {
    count: number;
    total: number;
    by_payment_method: Record<string, { count: number; total: number }>;
  };
  total_sales: number;
  total_amount: number;
}

const PDVDailySalesReport: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDailySales = async () => {
    try {
      setLoading(true);
      const start = new Date(`${date}T00:00:00-03:00`).toISOString();
      const end = new Date(`${date}T23:59:59.999-03:00`).toISOString();

      const { data: pdvSales, error: pdvError } = await supabase
        .from('pdv_sales')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('is_cancelled', false);

      if (pdvError) throw pdvError;

      const { data: deliverySales, error: deliveryError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .not('status', 'eq', 'cancelled');

      if (deliveryError) throw deliveryError;

      const pdvByPayment: Record<string, { count: number; total: number }> = {};
      pdvSales?.forEach(sale => {
        const method = sale.payment_type;
        if (!pdvByPayment[method]) {
          pdvByPayment[method] = { count: 0, total: 0 };
        }
        pdvByPayment[method].count += 1;
        pdvByPayment[method].total += sale.total_amount;
      });

      const deliveryByPayment: Record<string, { count: number; total: number }> = {};
      deliverySales?.forEach(sale => {
        const method = sale.payment_method;
        if (!deliveryByPayment[method]) {
          deliveryByPayment[method] = { count: 0, total: 0 };
        }
        deliveryByPayment[method].count += 1;
        deliveryByPayment[method].total += sale.total_price;
      });

      const pdvTotal = pdvSales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const deliveryTotal = deliverySales?.reduce((sum, sale) => sum + sale.total_price, 0) || 0;

      setSummary({
        pdv_sales: {
          count: pdvSales?.length || 0,
          total: pdvTotal,
          by_payment_method: pdvByPayment
        },
        delivery_sales: {
          count: deliverySales?.length || 0,
          total: deliveryTotal,
          by_payment_method: deliveryByPayment
        },
        total_sales: (pdvSales?.length || 0) + (deliverySales?.length || 0),
        total_amount: pdvTotal + deliveryTotal
      });
    } catch (error) {
      console.error('Erro ao buscar vendas do dia:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailySales();
  }, [date]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDailySales();
    setRefreshing(false);
  };

  return (
    <PermissionGuard hasPermission={hasPermission('can_view_sales_report')} showMessage={true}>
      <div className="space-y-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 /> Vendas do Dia
        </h1>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded"
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(summary, null, 2)}
          </pre>
        )}
      </div>
    </PermissionGuard>
  );
};

export default PDVDailySalesReport;
