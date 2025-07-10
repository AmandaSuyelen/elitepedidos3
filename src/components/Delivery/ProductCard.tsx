import React from 'react';
import { Product } from '../../types/product';
import { Plus, Tag, Clock, Star, Zap, Calendar } from 'lucide-react';
import { isProductAvailable, getAvailabilityMessage } from '../../utils/availability';
import { useProductScheduling } from '../../hooks/useProductScheduling';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useEffect, useState, useRef } from 'react';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
  disabled?: boolean;
  isSpecialOfTheDay?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onOpenModal, 
  disabled = false,
  isSpecialOfTheDay = false 
}) => {
  const { getProductSchedule } = useProductScheduling();
  const [productImage, setProductImage] = useState<string | null>(null);
  const hasSetCustomImage = useRef<boolean>(false);
  const { getProductImage } = useImageUpload();
  
  // Fetch product image when component mounts or product changes
  useEffect(() => {
    const loadProductImage = async () => {
      // Skip image loading if Supabase is not configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl === 'your_supabase_url_here' || 
          supabaseKey === 'your_supabase_anon_key_here') {
        console.log('ℹ️ Skipping product image loading - Supabase not configured');
        return;
      }
      
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Image load timeout')), 3000);
        });
        
        const imagePromise = getProductImage(product.id);
        const image = await Promise.race([imagePromise, timeoutPromise]);
        
        // Only set the image if we haven't set a custom image yet
        if (image && !hasSetCustomImage.current) {
          setProductImage(image);
          hasSetCustomImage.current = true;
        }
      } catch (error) {
        // Only log detailed error if it's not a timeout
        if (error instanceof Error && error.message !== 'Image load timeout') {
          console.error('Error loading product image:', error);
        } else {
          console.warn('Product image loading timed out');
        }
      }
    };
    
    loadProductImage();
  }, [product.id, getProductImage]);
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getDisplayPrice = () => {
    if (product.pricePerGram) {
      return (
        <div className="text-sm">
          <span className="block text-xs text-gray-500">A partir de</span>
          {formatPrice(product.pricePerGram * 100)}/100g
        </div>
      );
    }
    
    if (product.sizes && product.sizes.length > 0) {
      const minPrice = Math.min(...product.sizes.map(s => s.price));
      const maxPrice = Math.max(...product.sizes.map(s => s.price));
      
      if (minPrice === maxPrice) {
        return formatPrice(minPrice);
      }
      
      return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
    }
    
    return formatPrice(product.price);
  };

  const isAvailable = isProductAvailable(product) && !disabled;
  const availabilityMessage = disabled ? 'Loja fechada' : (() => {
    const message = getAvailabilityMessage(product);
    return typeof message === 'string' ? message : 'Verificando disponibilidade...';
  })();

  // Verificar se tem programação no banco
  const dbSchedule = getProductSchedule(product.id);
  const hasScheduling = dbSchedule?.enabled || product.scheduledDays?.enabled || product.availability?.scheduledDays?.enabled;

  // IMPORTANTE: Se o produto não está disponível devido à programação, não deve ser renderizado
  // Isso é tratado no DeliveryPage.tsx, mas aqui garantimos que o card reflita o status correto
  console.log(`🔍 ProductCard - ${product.name}:`, {
    isProductAvailable: isProductAvailable(product),
    isAvailable,
    hasScheduling,
    currentDay: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()]
  });
  
  // Use the fetched image or fall back to the default product image
  // Once we've set a custom image, we'll always use that
  const imageToShow = hasSetCustomImage.current && productImage ? productImage : product.image;
  
  // Ensure we always have a valid image URL
  const fallbackImage = "https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400";
  const finalImageUrl = imageToShow || fallbackImage;

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${
      !isAvailable ? 'opacity-75' : ''
    } ${isSpecialOfTheDay ? 'ring-2 ring-orange-400 ring-opacity-50' : ''}`}>
      <div className="relative">
        <img
          src={finalImageUrl}
          alt={product.name}
          className="w-full h-48 object-cover"
          onError={(e) => {
            // If image fails to load, use fallback
            const target = e.target as HTMLImageElement;
            if (target.src !== fallbackImage) {
              target.src = fallbackImage;
            }
          }}
        />
        
        {/* Badge de Promoção do Dia */}
        {isSpecialOfTheDay && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
            <Star size={12} />
            PROMOÇÃO DO DIA
          </div>
        )}
        
        {/* Badge de Programação */}
        {hasScheduling && !isSpecialOfTheDay && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Calendar size={12} />
            PROGRAMADO
          </div>
        )}
        
        {/* Badge de Promoção */}
        {product.originalPrice && !isSpecialOfTheDay && !hasScheduling && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Tag size={12} />
            PROMOÇÃO
          </div>
        )}

        {/* Badge de Indisponível */}
        {!isAvailable && !hasScheduling && (
          <div className="absolute top-2 left-2 bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Clock size={12} />
            {disabled ? 'FECHADO' : 'INDISPONÍVEL'}
          </div>
        )}
        
        {/* Preço no canto */}
        <div className={`absolute top-2 right-2 backdrop-blur-sm rounded-full px-3 py-1 ${
          isSpecialOfTheDay ? 'bg-orange-500/90 text-white' : 'bg-white/90'
        }`}>
          <span className="text-sm font-medium">
            <div className={`font-bold ${isSpecialOfTheDay ? 'text-white' : 'text-purple-600'}`}>
              {getDisplayPrice()}
            </div>
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-4 text-sm leading-relaxed">
          {product.description}
        </p>

        {/* Status de Disponibilidade */}
        <div className="mb-4">
          <div className={`flex items-center gap-2 text-sm ${
            isAvailable ? 'text-green-600' : 'text-red-600'
          }`}>
            <Clock size={16} />
            <span className="font-medium">
              {availabilityMessage}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">
            {product.originalPrice ? (
              <div className="flex items-center gap-2">
                <span className={isSpecialOfTheDay ? 'text-orange-600' : 'text-green-600'}>
                  {formatPrice(product.price)}
                </span>
                <span className="text-gray-500 line-through text-sm">
                  {formatPrice(product.originalPrice)}
                </span>
              </div>
            ) : (
              !product.pricePerGram && (
                <span className={isSpecialOfTheDay ? 'text-orange-600' : 'text-purple-600'}>
                  {getDisplayPrice()}
                </span>
              )
            )}
          </div>
          
          <button
            onClick={() => onOpenModal(product)}
            disabled={!isAvailable}
            className={`px-6 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg ${
              !isAvailable
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isSpecialOfTheDay
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isSpecialOfTheDay ? <Zap size={16} /> : <Plus size={16} />}
            {product.complementGroups && product.complementGroups.length > 0 
              ? 'Personalizar' 
              : isSpecialOfTheDay ? 'Aproveitar' : 'Adicionar'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;