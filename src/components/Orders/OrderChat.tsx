import React, { useState, useRef, useEffect } from 'react';
import { useOrderChat } from '../../hooks/useOrders';
import { Send, MessageCircle, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface OrderChatProps {
  orderId: string;
  customerName: string;
  isAttendant?: boolean;
}

const OrderChat: React.FC<OrderChatProps> = ({ 
  orderId, 
  customerName, 
  isAttendant = false 
}) => {
  console.log("Pedido ID:", orderId); // Debug: Check if orderId exists
  const [newMessage, setNewMessage] = useState('');
  const [senderName, setSenderName] = useState(isAttendant ? 'Atendente' : customerName);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const audioRef = useRef<HTMLAudioElement | null>(null); 
  
  const { messages, loading, sendMessage, lastFetch, refreshMessages, fetchMessages } = useOrderChat(orderId);
  const loadingTimerRef = useRef<number | null>(null);

  // Debug: Check messages being loaded
  useEffect(() => {
    console.log("Messages loaded:", messages);
    console.log("Order ID for chat:", orderId);
  }, [messages]);
  
  // Add auto-retry if messages don't load within 2 seconds
  useEffect(() => {
    if (loading) {
      // Clear any existing timer
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
      
      // Set a new timer to retry loading messages after 2 seconds
      loadingTimerRef.current = window.setTimeout(() => {
        console.log("⚠️ Auto-retry: Messages taking too long to load, forcing refresh...");
        refreshMessages();
      }, 2000);
    } else {
      // Clear the timer when loading completes
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
    
    return () => {
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, [loading, fetchMessages]);

  // Carregar configuração de som
  useEffect(() => {
    // Initialize audio element
    try {
      audioRef.current = new Audio();
      // Only set the src when we're ready to play to avoid cache issues
    } catch (error) {
      console.error('Error initializing audio element:', error);
    }
    
    try {
      console.log("🔊 Inicializando configurações de som do chat");
      const soundSettings = localStorage.getItem('chatSoundSettings');
      if (soundSettings) {
        const settings = JSON.parse(soundSettings);
        setSoundEnabled(settings.enabled);
        if (audioRef.current) {
          audioRef.current.volume = settings.volume || 0.5;
        }
      } else {
        // Create default settings if none exist
        localStorage.setItem('chatSoundSettings', JSON.stringify({ enabled: true, volume: 0.5, soundUrl: "https://assets.mixkit.co/active_storage/sfx/1862/1862-preview.mp3" }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de som:', error);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);


  // Salvar configuração de som
  const toggleSound = () => {
    try {
      const newState = !soundEnabled;
      setSoundEnabled(newState);
      
      // Salvar no localStorage
      const soundSettings = localStorage.getItem('chatSoundSettings');
      const settings = soundSettings ? JSON.parse(soundSettings) : { volume: 0.5, soundUrl: "https://assets.mixkit.co/active_storage/sfx/1862/1862-preview.mp3" };
      settings.enabled = newState;
      localStorage.setItem('chatSoundSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Erro ao salvar configurações de som:', error);
    }
  };


  // Function to play message sound
  const playMessageSound = () => {
    try {
      // Create a new Audio instance each time to avoid cache issues
      const audio = new Audio();
      audio.src = "https://assets.mixkit.co/active_storage/sfx/1862/1862-preview.mp3";
      
      // Add event listeners before setting src to avoid race conditions
      audio.oncanplaythrough = () => {
        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error('Error playing sound:', e);
            playMessageSoundFallback();
          }
        });
      };
      
      audio.onerror = (e) => {
        console.error('Audio error:', e);
        playMessageSoundFallback();
      }
      
      // Set a timeout to fall back if loading takes too long
      const timeout = setTimeout(() => {
        audio.onerror = null;
        audio.oncanplaythrough = null;
        playMessageSoundFallback();
      }, 2000);
      
      // Clean up on successful play
      audio.onplaying = () => {
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('Erro ao tocar som de mensagem:', error);
      playMessageSoundFallback();
    }
  };
  
  // Fallback sound method
  const playMessageSoundFallback = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Erro ao tocar som de fallback:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Conexão restaurada, recarregando mensagens...');
      setIsOnline(true);
      
      // Force refresh messages with a small delay to ensure connection is stable
      setTimeout(() => {
        refreshMessages();
      }, 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Conexão perdida');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      setMessageError('Você está offline. Aguarde a conexão ser restaurada para enviar mensagens.');
      return;
    }
    
    console.log("💬 Tentando enviar mensagem para o pedido:", orderId);
    try {
      const messageText = newMessage.trim();
      if (!messageText) return;
      
      setMessageError(null);
      setNewMessage(''); // Clear input immediately for better UX
      
      console.log('📤 Enviando mensagem:', messageText, "para o pedido:", orderId);
      await sendMessage(messageText, isAttendant ? 'attendant' : 'customer', senderName, { playSound: true });

      // Only play sound if enabled
      if (soundEnabled) {
        playMessageSound();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessageError('Erro ao enviar mensagem. Tente novamente.');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      // Loading state
      <div className="p-4 text-center cursor-pointer" onClick={() => refreshMessages()}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Carregando chat... (clique para tentar novamente)</p>
      </div>
    );
  }

  console.log("🔍 Renderizando chat com", messages.length, "mensagens para o pedido:", orderId);
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 flex flex-col h-[400px]">
      {/* Chat Header */}
      <div className="p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-purple-600" />
            <h4 className="font-medium text-gray-800">
              Chat do Pedido #{orderId.slice(-8)}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`p-1 rounded transition-colors ${soundEnabled ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
              title={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={refreshMessages}
              className="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors"
              title="Atualizar mensagens"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-500">
              {isOnline ? 'Online' : 'Offline'} • Última atualização: {lastFetch.toLocaleTimeString('pt-BR')}
            </span>
          </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <MessageCircle size={32} className="mx-auto text-gray-300 mb-2" />
            <p>Nenhuma mensagem ainda</p>
            <p>Inicie uma conversa!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = isAttendant 
              ? message.sender_type === 'attendant'
              : message.sender_type === 'customer';

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${
                      isOwnMessage ? 'text-purple-100' : 'text-gray-500'
                    }`}>
                      {message.sender_name}
                    </span>
                    <span className={`text-xs ${
                      isOwnMessage ? 'text-purple-200' : 'text-gray-400'
                    }`}>
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{message.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Indicador de status de conexão */}
      {!isOnline && (
        <div className="bg-red-50 border-t border-red-200 p-2">
          <div className="flex items-center gap-2 text-red-600 text-xs">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>Sem conexão - As mensagens serão sincronizadas quando a conexão for restaurada</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {messageError && (
        <div className="p-2 bg-red-50 border-t border-red-200">
          <div className="flex items-center gap-2 text-red-600 text-xs">
            <AlertCircle size={14} />
            <span>{messageError}</span>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-3 bg-white border-t border-gray-200">
        {isAttendant && (
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seu nome:
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Digite seu nome"
              className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isOnline ? "Digite sua mensagem..." : "Sem conexão..."}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            disabled={!isOnline}
            autoFocus
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isOnline}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white p-3 rounded-lg transition-colors flex-shrink-0"
            title={!isOnline ? 'Sem conexão' : 'Enviar mensagem'}
          >
            <Send size={18} />
          </button>
        </form>
        
        {!isOnline && (
          <p className="text-xs text-red-600 mt-1">
            Aguardando conexão para enviar mensagens...
          </p>
        )}
      </div>
    </div>
  );
};

export default OrderChat;