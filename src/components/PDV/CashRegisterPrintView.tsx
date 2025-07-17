import React, { useState, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { PDVCashRegister, PDVCashRegisterSummary, PDVCashRegisterEntry } from '../../types/pdv';

interface CashRegisterPrintViewProps {
  register: PDVCashRegister;
  summary: PDVCashRegisterSummary;
  entries: PDVCashRegisterEntry[];
  onClose: () => void;
}

const CashRegisterPrintView: React.FC<CashRegisterPrintViewProps> = ({
  register,
  summary,
  entries,
  onClose
}) => {
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'voucher': 'Voucher',
      'misto': 'Pagamento Misto'
    };
    return labels[method] || method;
  };

  const handlePrint = () => {
    window.print();
  };

  // Aplicar configurações de impressora ao estilo
  const printerStyle = `
    @media print {
      @page {
        size: ${printerSettings.paper_width} auto;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        background: white;
        font-family: 'Courier New', monospace;
        font-size: ${printerSettings.font_size}px;
        line-height: 1.2;
        color: black;
      }
      
      .print\\:hidden {
        display: none !important;
      }
      
      .thermal-receipt {
        width: ${printerSettings.paper_width === 'A4' ? '210mm' : printerSettings.paper_width};
        max-width: ${printerSettings.paper_width === 'A4' ? '210mm' : printerSettings.paper_width};
        margin: 0;
        padding: ${printerSettings.margin_top}mm ${printerSettings.margin_left}mm ${printerSettings.margin_bottom}mm;
        background: white;
        color: black;
        font-family: 'Courier New', monospace;
        font-size: ${printerSettings.font_size}px;
        line-height: 1.3;
        overflow: visible;
        max-height: none;
        transform: scale(${printerSettings.scale});
        transform-origin: top left;
      }
      
      .fixed {
        position: static !important;
      }
      
      .bg-black\\/50 {
        background: transparent !important;
      }
      
      .rounded-lg {
        border-radius: 0 !important;
      }
      
      .max-w-sm {
        max-width: none !important;
      }
      
      .w-full {
        width: ${printerSettings.paper_width === 'A4' ? '210mm' : printerSettings.paper_width} !important;
      }
      
      .max-h-\\[90vh\\] {
        max-height: none !important;
      }
      
      .overflow-hidden {
        overflow: visible !important;
      }
      
      /* Força cores para impressão térmica */
      * {
        color: black !important;
        background: white !important;
        border-color: black !important;
      }
      
      .bg-gray-100 {
        background: #f0f0f0 !important;
      }
      
      .border-dashed {
        border-style: dashed !important;
      }
      
      .border-dotted {
        border-style: dotted !important;
      }
      
      /* Quebras de página */
      .page-break {
        page-break-before: always;
      }
      
      .no-break {
        page-break-inside: avoid;
      }
      
      /* Otimizações para impressão térmica */
      .thermal-receipt h1 {
        font-size: ${printerSettings.font_size * 7}px !important;
        font-weight: bold !important;
        margin: 0 !important;
      }
      
      .thermal-receipt .text-xs {
        font-size: ${printerSettings.font_size * 5}px !important;
      }
      
      .thermal-receipt .text-lg {
        font-size: ${printerSettings.font_size * 6.5}px !important;
      }
      
      .thermal-receipt .font-bold {
        font-weight: bold !important;
      }
      
      .thermal-receipt .font-medium {
        font-weight: 600 !important;
      }
      
      /* Espaçamento otimizado */
      .thermal-receipt .mb-1 {
        margin-bottom: 1mm !important;
      }
      
      .thermal-receipt .mb-2 {
        margin-bottom: 2mm !important;
      }
      
      .thermal-receipt .mb-3 {
        margin-bottom: 3mm !important;
      }
      
      .thermal-receipt .pb-2 {
        padding-bottom: 2mm !important;
      }
      
      .thermal-receipt .pt-2 {
        padding-top: 2mm !important;
      }
      
      .thermal-receipt .p-1 {
        padding: 1mm !important;
      }
      
      .thermal-receipt .p-2 {
        padding: 2mm !important;
      }
      
      /* Bordas para impressão térmica */
      .thermal-receipt .border-b {
        border-bottom: 1px solid black !important;
      }
      
      .thermal-receipt .border-t {
        border-top: 1px solid black !important;
      }
      
      .thermal-receipt .border-dashed {
        border-style: dashed !important;
      }
      
      .thermal-receipt .border-dotted {
        border-style: dotted !important;
      }
      
      /* Flexbox para alinhamento */
      .thermal-receipt .flex {
        display: flex !important;
      }
      
      .thermal-receipt .justify-between {
        justify-content: space-between !important;
      }
      
      .thermal-receipt .text-center {
        text-align: center !important;
      }
      
      .thermal-receipt .break-all {
        word-break: break-all !important;
      }
    }
    
    /* Estilos para visualização na tela */
    .thermal-receipt {
      font-family: 'Courier New', monospace;
      max-width: 300px;
      background: white;
      border: 1px solid #ddd;
    }
  `;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] overflow-hidden">
        {/* Controles de impressão - não aparecem na impressão */}
        <div className="p-4 border-b border-gray-200 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Impressão Térmica - Movimentações do Caixa
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                title="Imprimir usando as configurações definidas"
              >
                Imprimir
              </button>
              <button
                onClick={onClose}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            <p>• Configure a impressora para "Térmico Direto"</p>
            <p>• Largura do papel: 80mm (79,5mm ± 0,5mm)</p>
            <p>• Use papel térmico de qualidade</p>
          </div>
        </div>

        {/* Conteúdo para impressão térmica */}
        <div className="thermal-receipt overflow-y-auto max-h-[calc(90vh-120px)] print:overflow-visible print:max-h-none">
          <div className="p-2 print:p-0">
            {/* Cabeçalho */}
            <div className="text-center mb-3 pb-2 border-b border-dashed border-gray-400">
              <div className="mb-2">
                <h1 className="text-lg font-bold">ELITE AÇAÍ</h1>
                <p className="text-xs">Relatório de Caixa</p>
              </div>
              
              <div className="text-xs space-y-1">
                <p>Rua Dois, 2130-A</p>
                <p>Residencial 1 - Cágado</p>
                <p>Tel: (85) 98904-1010</p>
                <p>WhatsApp: (85) 98904-1010</p>
              </div>
            </div>

            {/* Informações do Caixa */}
            <div className="mb-3 text-xs">
              <div className="text-center font-bold mb-2">
                === MOVIMENTAÇÕES DO CAIXA ===
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Caixa:</span>
                  <span>#{register.id.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Abertura:</span>
                  <span>{formatDate(register.opened_at)}</span>
                </div>
                {register.closed_at && (
                  <div className="flex justify-between">
                    <span>Fechamento:</span>
                    <span>{formatDate(register.closed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="mb-3 pb-2 border-b border-dashed border-gray-400">
              <div className="font-bold text-xs mb-1">RESUMO FINANCEIRO:</div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Valor de Abertura:</span>
                  <span>{formatPrice(summary.opening_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas PDV:</span>
                  <span>{formatPrice(summary.sales_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendas Delivery:</span>
                  <span>{formatPrice(summary.delivery_total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outras Entradas:</span>
                  <span>{formatPrice(summary.other_income_total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Saídas:</span>
                  <span>{formatPrice(summary.total_expense)}</span>
                </div>
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex justify-between font-bold">
                    <span>SALDO ESPERADO:</span>
                    <span>{formatPrice(summary.expected_balance)}</span>
                  </div>
                </div>
                {register.closing_amount !== null && (
                  <>
                    <div className="flex justify-between">
                      <span>Valor de Fechamento:</span>
                      <span>{formatPrice(register.closing_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diferença:</span>
                      <span className={register.difference && register.difference >= 0 ? 'font-bold' : 'font-bold'}>
                        {formatPrice(register.difference || 0)}
                        {register.difference && register.difference > 0 ? ' (sobra)' : 
                         register.difference && register.difference < 0 ? ' (falta)' : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Movimentações Detalhadas */}
            <div className="mb-3">
              <div className="font-bold text-xs mb-2">MOVIMENTAÇÕES DETALHADAS:</div>
              
              {entries.length === 0 ? (
                <div className="text-xs text-center py-2">
                  Nenhuma movimentação registrada
                </div>
              ) : (
                entries.map((entry, index) => (
                  <div key={entry.id} className="mb-2 pb-2 border-b border-dotted border-gray-300">
                    <div className="text-xs">
                      <div className="flex justify-between font-medium mb-1">
                        <span>{index + 1}. {entry.type === 'income' ? 'ENTRADA' : 'SAÍDA'}</span>
                        <span className={entry.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {entry.type === 'income' ? '+' : '-'}{formatPrice(entry.amount)}
                        </span>
                      </div>
                      
                      <div className="ml-2">
                        <div>Descrição: {entry.description}</div>
                        <div>Forma: {getPaymentMethodLabel(entry.payment_method)}</div>
                        <div>Data: {formatDate(entry.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totais por Forma de Pagamento */}
            <div className="mb-3 pb-2 border-b border-dashed border-gray-400">
              <div className="font-bold text-xs mb-1">POR FORMA DE PAGAMENTO:</div>
              <div className="text-xs space-y-1">
                {['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'].map(method => {
                  const methodEntries = entries.filter(e => e.payment_method === method);
                  const income = methodEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
                  const expense = methodEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
                  const total = income - expense;
                  
                  if (total !== 0) {
                    return (
                      <div key={method} className="flex justify-between">
                        <span>{getPaymentMethodLabel(method)}:</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            {/* Rodapé */}
            <div className="text-center text-xs border-t border-dashed border-gray-400 pt-2">
              <div className="mb-2">
                <div className="font-bold">RELATÓRIO DE CAIXA</div>
                <div>Elite Açaí - Sistema PDV</div>
              </div>
              
              <div className="space-y-1">
                <div>Operador: Sistema</div>
                <div>Impresso: {new Date().toLocaleString('pt-BR')}</div>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-300 text-xs">
                <div>Elite Açaí - CNPJ: 00.000.000/0001-00</div>
                <div>Este é um relatório interno</div>
                <div>Não é um documento fiscal</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Estilos específicos para impressão térmica */}
      <style jsx>{printerStyle}</style>
    </div>
  );
};

export default CashRegisterPrintView;