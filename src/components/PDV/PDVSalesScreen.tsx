import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Calculator, CreditCard, Printer, Trash2, Plus, Minus, Scale, AlertCircle, DollarSign, Percent, X, Save, Package, Tag, Receipt, Divide, Settings } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { usePDVProducts, usePDVCart, usePDVSales } from '../../hooks/usePDV'; 
import { useScale } from '../../hooks/useScale';
import { PDVProduct } from '../../types/pdv';
import { usePDVCashRegister } from '../../hooks/usePDVCashRegister';
import { useWeightFromScale } from '../../hooks/useWeightFromScale';
import { useImageUpload } from '../../hooks/useImageUpload';
import ScaleWeightModal from './ScaleWeightModal';
import { supabase } from '../../lib/supabase';

interface PDVSalesScreenProps {
  scaleHook?: ReturnType<typeof useScale>;
  operator?: any;
  storeSettings?: any;
}

const PDVSalesScreen: React.FC<PDVSalesScreenProps> = ({ scaleHook, operator, storeSettings }) => {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState<'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'voucher' | 'misto'>('dinheiro');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitPayment, setSplitPayment] = useState(false);
  const [selectedWeighableProduct, setSelectedWeighableProduct] = useState<PDVProduct | null>(null);
  const [showScaleWeightModal, setShowScaleWeightModal] = useState(false);
  const { fetchWeight, loading: weightLoading, confirmWeight } = useWeightFromScale();
  const [payments, setPayments] = useState<Array<{type: string, amount: number}>>([]);
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState<number>(0);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Get permissions
  const { hasPermission } = usePermissions();
  
  // Carregar configurações de impressora
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

  const { products, loading: productsLoading, searchProducts } = usePDVProducts();
  const { isOpen: isCashRegisterOpen, currentRegister } = usePDVCashRegister();
  const { 
    currentWeight,
    requestStableWeight,
    isReading,
    simulateWeight,
  } = scaleHook || useScale();
  
  const { 
    items, 
    addItem, 
    removeItem, 
    updateItemQuantity, 
    updateItemWeight,
    applyItemDiscount,
    discount,
    setDiscount,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getTotal,
    itemCount 
  } = usePDVCart();
  const { createSale } = usePDVSales();
  const { summary } = usePDVCashRegister();

  // Image handling
  const { getProductImage } = useImageUpload();
  const [productImages, setProductImages] = useState<Record<string, string>>({});

  const categories = [
    { id: 'all', label: 'Todos', icon: Package, color: 'bg-gray-600' },
    { id: 'acai', label: 'Açaí', icon: Package, color: 'bg-purple-600' },
    { id: 'sorvetes', label: 'Sorvetes', icon: Package, color: 'bg-cyan-600' },
    { id: 'bebidas', label: 'Bebidas', icon: Package, color: 'bg-green-600' },
    { id: 'gelatos', label: 'Gelatos', icon: Package, color: 'bg-pink-600' },
    { id: 'cremes', label: 'Cremes', icon: Package, color: 'bg-yellow-600' },
    { id: 'massas', label: 'Massas', icon: Package, color: 'bg-red-600' }
  ];

  const paymentTypes = [
    { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
    { id: 'pix', label: 'PIX', icon: '📱' },
    { id: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
    { id: 'cartao_debito', label: 'Cartão Débito', icon: '💳' },
    { id: 'voucher', label: 'Voucher', icon: '🎫' }
  ];

  // Filtrar produtos
  const filteredProducts = React.useMemo(() => {
    let result = searchTerm ? searchProducts(searchTerm) : products;
    
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    // Ordenar por nome
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchProducts, searchTerm, selectedCategory]);

  // Carregar imagens personalizadas dos produtos
  React.useEffect(() => {
    const loadProductImages = async () => {
      // Check if Supabase is properly configured before attempting to load images
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl === 'your_supabase_url_here' || 
          supabaseKey === 'your_supabase_anon_key_here' ||
          supabaseUrl.includes('placeholder')) {
        console.info('ℹ️ Supabase não configurado. Usando imagens padrão dos produtos.');
        console.info('   Para habilitar imagens personalizadas:');
        console.info('   1. Configure suas credenciais do Supabase no arquivo .env');
        console.info('   2. Substitua os valores placeholder pelas suas credenciais reais');
        return;
      }

      try {
        console.log('🖼️ Carregando imagens personalizadas dos produtos...');
        
        // Load images in smaller batches with better error handling
        const batchSize = 2;
        const imageMap: Record<string, string> = {};
        let successCount = 0;
        let errorCount = 0;
        let networkErrorCount = 0;
        
        for (let i = 0; i < products.length; i += batchSize) {
          const batch = products.slice(i, i + batchSize);
          
          const imagePromises = batch.map(async (product) => {
            try {
              // Add timeout to individual image requests with better error handling
              const timeoutPromise = new Promise<string | null>((_, reject) => {
                setTimeout(() => reject(new Error('Individual image timeout')), 4000);
              });
              
              const imagePromise = getProductImage(product.id);
              const imageUrl = await Promise.race([imagePromise, timeoutPromise]);
              
              if (imageUrl) {
                successCount++;
                return { productId: product.id, imageUrl, success: true };
              } else {
                return { productId: product.id, imageUrl: null, success: true };
              }
            } catch (error) {
              errorCount++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              
              if (error instanceof Error) {
                if (errorMessage.includes('timeout')) {
                  console.warn(`⏱️ Timeout ao carregar imagem do produto ${product.id}`);
                } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch')) {
                  networkErrorCount++;
                  console.warn(`🌐 Falha na conexão ao carregar imagem do produto ${product.id}`);
                } else {
                  console.warn(`⚠️ Erro ao carregar imagem do produto ${product.id}:`, errorMessage);
                }
              }
              return { productId: product.id, imageUrl: null, success: false };
            }
          });
          
          try {
            // Use allSettled to handle individual failures gracefully
            const results = await Promise.allSettled(imagePromises);
            
            results.forEach((result) => {
              if (result.status === 'fulfilled') {
                const { productId, imageUrl } = result.value;
                if (imageUrl) {
                  imageMap[productId] = imageUrl;
                }
              } else {
                errorCount++;
                console.warn(`⚠️ Falha ao processar imagem em lote:`, result.reason?.message || 'Erro desconhecido');
              }
            });
          } catch (batchError) {
            console.warn(`⚠️ Erro crítico no lote de imagens:`, batchError instanceof Error ? batchError.message : 'Erro desconhecido');
            errorCount += batch.length;
          }
          
          // Longer delay between batches to reduce server load and avoid rate limiting
          if (i + batchSize < products.length) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
        
        setProductImages(imageMap);
        const loadedCount = Object.keys(imageMap).length;
        
        if (loadedCount > 0) {
          console.log(`✅ ${loadedCount} imagens personalizadas carregadas com sucesso`);
        }
        
        if (errorCount > 0) {
          if (networkErrorCount > 0) {
            console.info(`ℹ️ ${networkErrorCount} imagens falharam por problemas de rede (usando imagens padrão)`);
            console.info('   💡 Verifique sua conexão com a internet e configurações do Supabase');
          }
          if (errorCount - networkErrorCount > 0) {
            console.info(`ℹ️ ${errorCount - networkErrorCount} outras imagens falharam ao carregar`);
          }
        }
        
        if (loadedCount === 0 && errorCount === 0) {
          console.info('ℹ️ Nenhuma imagem personalizada encontrada. Usando imagens padrão.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch')) {
          console.warn('🌐 Problema de conectividade com o Supabase detectado');
          console.info('ℹ️ Usando imagens padrão dos produtos. Verifique:');
          console.info('   • Sua conexão com a internet');
          console.info('   • Se as credenciais do Supabase estão corretas');
          console.info('   • Se o projeto Supabase está ativo');
        } else {
          console.warn('⚠️ Erro geral ao carregar imagens personalizadas:', errorMessage);
          console.info('ℹ️ Continuando com imagens padrão dos produtos.');
        }
        
        // Provide helpful error context for network issues
        if (error instanceof TypeError && errorMessage.includes('Failed to fetch')) {
          console.info('   💡 Dicas para resolver problemas de conexão:');
          console.info('   • Verifique sua conexão com a internet');
          console.info('   • Confirme se as credenciais do Supabase estão corretas no arquivo .env');
          console.info('   • Verifique se o projeto Supabase está ativo e acessível');
          console.info('   • Aguarde alguns segundos e recarregue a página');
        }
      }
    };

    // Only attempt to load images if we have products and avoid loading on every render
    if (products.length > 0) {
      // Debounce the image loading to avoid multiple rapid calls
      const timeoutId = setTimeout(() => {
        loadProductImages();
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [products.length, getProductImage]); // Only depend on products length to avoid unnecessary reloads

  // Adicionar produto ao carrinho
  const handleAddProduct = async (product: PDVProduct) => {
    if (product.is_weighable) {
      // Para produtos pesáveis, tentar ler o peso da balança
      setSelectedWeighableProduct(product);      
      setShowScaleWeightModal(true);
    } else {
      addItem(product, 1);
    }
  };

  // Handler for weight confirmation from modal
  const handleWeightConfirm = (weight: number) => {
    if (selectedWeighableProduct && weight > 0) {
      // weight is already in grams, convert to kg for storage
      const pesoEmKg = weight / 1000;
      const precoPorKg = selectedWeighableProduct.price_per_gram ? selectedWeighableProduct.price_per_gram * 1000 : 44.99;
      
      confirmWeight(pesoEmKg);
      // Adicionar ao carrinho
      addItem(selectedWeighableProduct, 1, pesoEmKg);
      
      // Mostrar confirmação
      console.log(`Produto adicionado: ${selectedWeighableProduct.name}\nPeso: ${pesoEmKg.toFixed(3)}kg\nValor: ${formatPrice(pesoEmKg * precoPorKg)}`);
      setSelectedWeighableProduct(null);
    }
  };

  // Aplicar desconto geral
  const handleApplyDiscount = () => {
    // Check if user has permission to apply discounts
    if (!hasPermission('can_discount')) {
      alert('Você não tem permissão para aplicar descontos.');
      return;
    }
    
    const type = prompt('Tipo de desconto (% ou R$):');
    const value = prompt('Valor do desconto:');
    
    if (type && value) {
      const discountValue = parseFloat(value);
      if (discountValue > 0) {
        setDiscount({
          type: type === '%' ? 'percentage' : 'amount',
          value: discountValue
        });
      }
    }
  };

  // Finalizar venda
  const handleFinalizeSale = async () => {
    // Check if user has permission to make sales
    if (!hasPermission('can_view_sales')) {
      alert('Você não tem permissão para finalizar vendas.');
      return;
    }
    
    if (items.length === 0) {
      alert('Carrinho vazio. Adicione produtos antes de finalizar a venda.');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🚀 Iniciando finalização da venda...');
      
      // Check if cash register is open
      if (!isCashRegisterOpen || !currentRegister) {
        throw new Error('Não é possível finalizar venda sem um caixa aberto');
      }
      
      const saleData = {
        operator_id: operator?.id || 'admin-id',
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        subtotal: getSubtotal(),
        discount_amount: getDiscountAmount(),
        discount_percentage: discount.type === 'percentage' ? discount.value : 0,
        total_amount: getTotal(),
        payment_type: paymentType,
        payment_details: payments.length > 0 ? payments : undefined,
        change_amount: paymentType === 'dinheiro' ? Math.max(0, receivedAmount - getTotal()) : 0,
        // Force refresh of scale connection status after closing modal
        channel: 'pdv'
      };

      const saleItems = items.map(item => ({
        product_id: item.product.id,
        product_code: item.product.code,
        product_name: item.product.name,
        quantity: item.quantity,
        weight_kg: item.weight,
        unit_price: item.product.unit_price,
        price_per_gram: item.product.price_per_gram,
        discount_amount: item.discount,
        subtotal: item.subtotal
      }));

      console.log('📦 Dados da venda preparados, enviando para API...');
      
      // Ativar modo debug para ver logs detalhados
      const sale = await createSale(saleData, saleItems, true, true);
      
      console.log('✅ Venda finalizada com sucesso:', sale);
      
      // Show success modal with better design
      const successModal = document.createElement('div');
      successModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm';
      successModal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
          <div class="text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">Venda finalizada!</h3>
            <p class="text-gray-600 mb-6">Número: <span class="font-mono font-bold text-purple-600">${sale.sale_number}</span></p>
            <div class="flex flex-col gap-3">
              <button class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors">
                Imprimir Comprovante
              </button>
              <button class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(successModal);
      
      // Add event listeners to buttons
      const buttons = successModal.querySelectorAll('button');
      if (buttons.length >= 2) {
        // Print button
        buttons[0].addEventListener('click', () => {
          handlePrintReceipt();
          document.body.removeChild(successModal);
        });
        
        // Close button
        buttons[1].addEventListener('click', () => {
          document.body.removeChild(successModal);
        });
      }
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        if (document.body.contains(successModal)) {
          document.body.removeChild(successModal);
        }
      }, 5000);

      // Limpar carrinho
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setReceivedAmount(0);
      setShowPayment(false);
      setPayments([]);
      setSplitPayment(false);
      
      // TODO: Imprimir cupom se configurado
      
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      
      // Mensagem de erro mais detalhada
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro desconhecido ao finalizar venda';
        
      // Mostrar erro com estilo melhorado
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm';
      errorModal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
          <div class="text-center">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">Erro ao finalizar venda</h3>
            <p class="text-gray-600 mb-6">${errorMessage}</p>
            <button class="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors">
              Entendi
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(errorModal);
      
      // Adicionar evento ao botão
      const button = errorModal.querySelector('button');
      if (button) {
        button.addEventListener('click', () => {
          document.body.removeChild(errorModal);
        });
      }
      
      // Auto-fechar após 5 segundos
      setTimeout(() => {
        if (document.body.contains(errorModal)) {
          document.body.removeChild(errorModal);
        }
      }, 5000);
      
      // Log detalhado para depuração
      console.error('📊 Estado do carrinho no momento do erro:', {
        items,
        customerName,
        customerPhone,
        paymentType,
        receivedAmount,
        total: getTotal()
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getChangeAmount = () => {
    if (paymentType === 'dinheiro' && receivedAmount > 0) {
      return Math.max(0, receivedAmount - getTotal());
    }
    return 0;
  };

  const getRemainingAmount = () => {
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return Math.max(0, getTotal() - totalPaid);
  };

  const handleAddSplitPayment = () => {
    if (currentPaymentAmount <= 0) return;
    
    const newPayment = {
      type: paymentType,
      amount: currentPaymentAmount
    };
    
    setPayments([...payments, newPayment]);
    setCurrentPaymentAmount(0);
    
    // If fully paid, proceed to finalize
    if (getRemainingAmount() - currentPaymentAmount <= 0) {
      handleFinalizeSale();
    }
  };

  const handlePrintReceipt = () => {
    setShowPrintPreview(true);
  };


  // Handle scale test modal close with refresh of connection status
  const handleScaleTestClose = () => {
    setShowScaleConfig(false);
    try {
      console.log('🔄 Fechando painel de teste da balança e preservando estado da conexão', {
        isConnected: scaleConnection?.isConnected,
        port: scaleConnection?.port
      });
    } catch (error) {
      console.warn('⚠️ Error logging scale connection:', error);
    }
    // Force refresh of scale connection status
    setScaleStatusKey(prev => prev + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Produtos */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Busca */}
            <div className="w-full relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produtos por nome ou código..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Categorias */}
        <div className="p-3 border-b border-gray-200 bg-white overflow-x-auto">
          <div className="flex gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? `${category.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <category.icon size={18} />
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Produtos */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {productsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-white hover:bg-blue-50 border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md flex flex-col h-full transition-colors"
                >
                  {/* Product Image with hover effect */}
                  <div className="relative h-32 bg-gray-100">
                    {productImages[product.id] ? (
                      <img 
                        src={productImages[product.id]} 
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} className="text-gray-300" />
                      </div>
                    )}
                    
                    {/* Product Code */}
                    <div className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-gray-700">
                      {product.code}
                    </div>
                    
                    {/* Weighable Indicator */}
                    {product.is_weighable && (
                      <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-1">
                        <Scale size={14} />
                      </div>
                    )}
                    
                    {/* Price */}
                    <div className="absolute bottom-2 right-2 bg-green-600 text-white px-2 py-1 rounded-lg text-sm font-bold">
                      {product.is_weighable 
                        ? `${formatPrice((product.price_per_gram || 0) * 1000)}/kg`
                        : formatPrice(product.unit_price || 0)
                      }
                    </div>
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-medium text-gray-800 text-sm mb-1 line-clamp-2">
                      {product.name}
                    </h3>
                    
                    {product.stock_quantity <= product.min_stock && (
                      <div className="flex items-center gap-1 mt-auto text-red-500">
                        <AlertCircle size={12} />
                        <span className="text-xs">Estoque baixo</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Add Button */}
                  <button
                    onClick={() => handleAddProduct(product)}
                    className="w-full py-2 text-center font-medium transition-all duration-200 bg-blue-500 hover:bg-blue-600 text-white hover:shadow-md"
                    disabled={product.is_weighable && weightLoading}
                  >
                    <Plus size={16} className="inline-block mr-1" />
                    {product.is_weighable ? (weightLoading ? 'Pesando...' : 'Pesar') : 'Adicionar'}
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Package size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Tente buscar por outro nome ou categoria</p>
            </div>
          )}
        </div>
        
        {/* Cash Register Closed Warning */}
        {!isCashRegisterOpen && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mt-4 shadow-md">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 rounded-full p-2 mt-0.5">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 mb-1">Caixa Fechado</h3>
                <p className="text-red-700">Não é possível realizar vendas sem um caixa aberto. Por favor, abra um caixa primeiro na aba "Caixas".</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Carrinho e Pagamento */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={20} />
              Carrinho ({itemCount})
            </h2>
            {itemCount > 0 && (
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                title="Limpar carrinho"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Seu carrinho está vazio</p>
              <p className="text-sm text-gray-400">Adicione produtos para iniciar uma venda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800 text-sm">{item.product.name}</h4>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {item.product.is_weighable ? (
                      <div className="text-sm text-gray-600">
                        <p>Peso: {item.weight ? (item.weight * 1000).toFixed(0) : '0'}g</p>
                        <p>{formatPrice((item.product.price_per_gram || 0) * 1000)}/kg</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                          className="bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                          className="bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                    
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatPrice(item.subtotal)}</p>
                      {item.discount > 0 && (
                        <p className="text-xs text-red-500">-{formatPrice(item.discount)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totais e Pagamento */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
            {/* Resumo */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatPrice(getSubtotal())}</span>
              </div>
              {getDiscountAmount() > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>-{formatPrice(getDiscountAmount())}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-green-600">{formatPrice(getTotal())}</span>
              </div>
              
              {splitPayment && payments.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium text-gray-700 mb-1">Pagamentos:</div>
                  {payments.map((payment, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{paymentTypes.find(t => t.id === payment.type)?.label || payment.type}:</span>
                      <span>{formatPrice(payment.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium text-blue-600 mt-1">
                    <span>Restante:</span>
                    <span>{formatPrice(getRemainingAmount())}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleApplyDiscount}
                className="bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                disabled={!hasPermission('can_discount')}
              >
                <Percent size={16} />
                Desconto
              </button>
              
              <button
                onClick={handlePrintReceipt}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                Imprimir
              </button>
              
              <button
                onClick={() => {
                  setCurrentPaymentAmount(getTotal());
                  setSplitPayment(false);
                  setShowPayment(true);
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign size={16} />
                Pagamento
              </button>
              
              <button
                onClick={() => {
                  setCurrentPaymentAmount(getRemainingAmount());
                  setSplitPayment(true);
                  setShowPayment(true);
                }}
                className="bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Divide size={16} />
                Dividir
              </button>
            </div>
            
            <button
              onClick={handleFinalizeSale}
              disabled={isProcessing || items.length === 0 || (splitPayment && getRemainingAmount() > 0)}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Finalizar Venda
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal de Pagamento */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {splitPayment ? 'Pagamento Parcial' : 'Finalizar Pagamento'}
              </h2>
              <button
                onClick={() => setShowPayment(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Dados do Cliente */}
            {!splitPayment && (
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente (opcional)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Telefone (opcional)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Forma de Pagamento */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {paymentTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setPaymentType(type.id as any)}
                    className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                      paymentType === type.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <div>{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {splitPayment ? 'Valor Parcial' : 'Valor Recebido'}
              </label>
              <input
                type="number"
                step="0.01"
                value={splitPayment ? currentPaymentAmount : receivedAmount}
                onChange={(e) => splitPayment 
                  ? setCurrentPaymentAmount(parseFloat(e.target.value) || 0)
                  : setReceivedAmount(parseFloat(e.target.value) || 0)
                }
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
              {splitPayment && (
                <p className="text-sm text-blue-600 mt-1">
                  Restante a pagar: {formatPrice(getRemainingAmount())}
                </p>
              )}
              {!splitPayment && paymentType === 'dinheiro' && receivedAmount > getTotal() && (
                <p className="text-sm text-green-600 mt-1">
                  Troco: {formatPrice(receivedAmount - getTotal())}
                </p>
              )}
            </div>

            {/* Resumo Final */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total a Pagar:</span>
                <span className="text-green-600">
                  {formatPrice(splitPayment ? getRemainingAmount() : getTotal())}
                </span>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              {splitPayment ? (
                <button
                  onClick={handleAddSplitPayment}
                  disabled={currentPaymentAmount <= 0 || currentPaymentAmount > getRemainingAmount()}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Adicionar
                </button>
              ) : (
                <button
                  onClick={handleFinalizeSale}
                  disabled={isProcessing || (paymentType === 'dinheiro' && receivedAmount < getTotal())}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Finalizar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Imprimir Comprovante</h2>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto font-mono text-sm">
              <div className="text-center mb-4">
                <p className="font-bold">ELITE AÇAÍ</p>
                <p>CNPJ: {storeSettings?.cnpj || '00.000.000/0001-00'}</p>
                <p>Rua das Frutas, 123 - Centro</p>
                <p>Tel: (85) 98904-1010</p>
                <p>--------------------------</p>
                <p>CUPOM NÃO FISCAL</p>
                <p>--------------------------</p>
              </div>
              
              <div className="mb-4">
                <p>Data: {new Date().toLocaleDateString()}</p>
                <p>Hora: {new Date().toLocaleTimeString()}</p>
                {customerName && <p>Cliente: {customerName}</p>}
                {customerPhone && <p>Telefone: {customerPhone}</p>}
                <p>--------------------------</p>
              </div>
              
              <div className="mb-4">
                <p className="font-bold">ITENS</p>
                {items.map((item, index) => (
                  <div key={index} className="mb-2">
                    <p>{item.product.name}</p>
                    {item.product.is_weighable ? (
                      <p>{(item.weight || 0) * 1000}g x {formatPrice((item.product.price_per_gram || 0) * 1000)}/kg = {formatPrice(item.subtotal)}</p>
                    ) : (
                      <p>{item.quantity} x {formatPrice(item.product.unit_price || 0)} = {formatPrice(item.subtotal)}</p>
                    )}
                    {item.discount > 0 && <p>Desconto: -{formatPrice(item.discount)}</p>}
                  </div>
                ))}
                <p>--------------------------</p>
              </div>
              
              <div className="mb-4">
                <p>Subtotal: {formatPrice(getSubtotal())}</p>
                {getDiscountAmount() > 0 && <p>Desconto: -{formatPrice(getDiscountAmount())}</p>}
                <p className="font-bold">TOTAL: {formatPrice(getTotal())}</p>
                <p>--------------------------</p>
              </div>
              
              <div className="mb-4">
                {paymentType === 'dinheiro' && receivedAmount > 0 && (
                  <>
                    <p>Valor Recebido: {formatPrice(receivedAmount)}</p>
                    <p>Troco: {formatPrice(getChangeAmount())}</p>
                  </>
                )}
                <p>--------------------------</p>
              </div>
              
              <div className="text-center">
                <p>Obrigado pela preferência!</p>
                <p>Volte sempre!</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  window.print();
                  setShowPrintPreview(false);
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Scale Weight Modal */}
      {showScaleWeightModal && selectedWeighableProduct && (
        <ScaleWeightModal
          isOpen={showScaleWeightModal}
          onClose={() => setShowScaleWeightModal(false)}
          onWeightConfirm={handleWeightConfirm}
          productName={selectedWeighableProduct.name}
          isScaleConnected={true}
          currentWeight={currentWeight}
          requestStableWeight={requestStableWeight}
          isReading={isReading}
        />
      )}
    </div>
  );
};

export default PDVSalesScreen;