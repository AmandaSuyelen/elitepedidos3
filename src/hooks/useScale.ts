import { useState, useEffect, useCallback, useRef } from 'react';
import { WeightReading, ScaleConnection } from '../types/pdv'; 

// Mock available ports for development/testing
const MOCK_AVAILABLE_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', '/dev/ttyUSB0', '/dev/ttyS0', '/dev/ttyACM0'];

export const useScale = () => {
  const [connection, setConnection] = useState<ScaleConnection>({
    isConnected: false
  });
  const [currentWeight, setCurrentWeight] = useState<WeightReading | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null); 
  const reconnectTimerRef = useRef<number | null>(null);
  const stableWeightTimerRef = useRef<number | null>(null);
  const lastWeightRef = useRef<WeightReading | null>(null);
  const selectedPortRef = useRef<string | null>(null);
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  
  // Create refs to break circular dependency
  const startReadingRef = useRef<(() => Promise<void>) | null>(null);
  const reconnectRef = useRef<(() => Promise<void>) | null>(null);
  
  // Check if Web Serial API is supported
  const isWebSerialSupported = !!navigator.serial;

  const [scaleConfig, setScaleConfig] = useState({
    baudRate: 4800, // Changed from 9600 to 4800
    dataBits: 8,
    protocol: 'PRT2',
    stopBits: 1,
    parity: 'none' as const,
    flowControl: 'none' as const,
    reconnectInterval: 3000, // Intervalo de reconexão em ms
    stableWeightTimeout: 5000, // Timeout para peso estável em ms
    weightPattern: /([ST|US]),([GS|NT]),([+-])(\d+\.?\d*)(kg|g)/i, // Padrão para reconhecer o peso
  });

  // Check if Web Serial API is available
  const listAvailablePorts = useCallback(async (): Promise<string[]> => {
    if (!isWebSerialSupported) {
      console.warn('⚠️ Web Serial API not supported');
      setAvailablePorts(MOCK_AVAILABLE_PORTS);
      return MOCK_AVAILABLE_PORTS;
    }

    try {
      const ports = await navigator.serial.getPorts();
      const portNames = ports.map((_, index) => `Serial Port ${index + 1}`);
      setAvailablePorts(portNames.length > 0 ? portNames : MOCK_AVAILABLE_PORTS);
      return portNames.length > 0 ? portNames : MOCK_AVAILABLE_PORTS;
    } catch (error) {
      console.error('❌ Error listing ports:', error);
      setAvailablePorts(MOCK_AVAILABLE_PORTS);
      return MOCK_AVAILABLE_PORTS;
    }
  }, [isWebSerialSupported]);

  // Connect to scale
  const connect = useCallback(async (portName?: string): Promise<boolean> => {
    if (!isWebSerialSupported) {
      setLastError('Web Serial API não é suportado neste navegador');
      return false;
    }

    try {
      setLastError(null);
      
      if (!portRef.current) {
        const port = await navigator.serial.requestPort();
        portRef.current = port;
      }

      await portRef.current.open({
        baudRate: scaleConfig.baudRate,
        dataBits: scaleConfig.dataBits,
        stopBits: scaleConfig.stopBits,
        parity: scaleConfig.parity,
        flowControl: scaleConfig.flowControl
      });

      setConnection({
        isConnected: true,
        port: portName || 'Selected Port'
      });

      selectedPortRef.current = portName || 'Selected Port';
      console.log('✅ Scale connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Error connecting to scale:', error);
      setLastError(`Erro ao conectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return false;
    }
  }, [scaleConfig, isWebSerialSupported]);

  // Disconnect from scale
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      setIsReading(false);
      
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (stableWeightTimerRef.current) {
        clearTimeout(stableWeightTimerRef.current);
        stableWeightTimerRef.current = null;
      }

      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }

      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }

      setConnection({ isConnected: false });
      setCurrentWeight(null);
      setReconnecting(false);
      console.log('✅ Scale disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }, []);

  // Start reading weight data
  const startReading = useCallback(async (): Promise<void> => {
    if (!connection.isConnected || !portRef.current) {
      setLastError('Balança não conectada');
      return;
    }

    try {
      setIsReading(true);
      setLastError(null);

      const reader = portRef.current.readable?.getReader();
      if (!reader) {
        throw new Error('Não foi possível obter o leitor da porta');
      }

      readerRef.current = reader;

      while (isReading && connection.isConnected) {
        try {
          const { value, done } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          console.log('📊 Raw scale data:', text);

          const weightData = parseToledoWeight(text);
          if (weightData) {
            const reading: WeightReading = {
              value: weightData.value,
              unit: weightData.unit,
              stable: weightData.stable,
              timestamp: new Date()
            };

            setCurrentWeight(reading);
            lastWeightRef.current = reading;
            console.log('⚖️ Weight reading:', reading);
          }
        } catch (readError) {
          console.error('❌ Error reading from scale:', readError);
          if (reconnectRef.current) {
            await reconnectRef.current();
          }
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error starting reading:', error);
      setLastError(`Erro na leitura: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setIsReading(false);
    }
  }, [connection.isConnected, isReading]);

  // Request stable weight
  const requestStableWeight = useCallback(async (): Promise<WeightReading | null> => {
    return new Promise((resolve) => {
      if (!connection.isConnected) {
        resolve(null);
        return;
      }

      if (stableWeightTimerRef.current) {
        clearTimeout(stableWeightTimerRef.current);
      }

      stableWeightTimerRef.current = window.setTimeout(() => {
        resolve(lastWeightRef.current);
      }, scaleConfig.stableWeightTimeout);
    });
  }, [connection.isConnected, scaleConfig.stableWeightTimeout]);

  // Simulate weight for testing
  const simulateWeight = useCallback((weight: number, unit: string = 'kg'): void => {
    const reading: WeightReading = {
      value: weight,
      unit,
      stable: true,
      timestamp: new Date()
    };
    setCurrentWeight(reading);
    lastWeightRef.current = reading;
  }, []);

  // Update scale configuration
  const updateConfig = useCallback((newConfig: Partial<typeof scaleConfig>): void => {
    setScaleConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Rest of the code remains the same...

  return {
    connection,
    currentWeight,
    isReading,
    availablePorts,
    lastError,
    reconnecting,
    scaleConfig,
    isWebSerialSupported,
    connect,
    disconnect,
    startReading,
    listAvailablePorts,
    requestStableWeight,
    simulateWeight,
    updateConfig
  };
};

// Function to parse Toledo scale data
const parseToledoWeight = (data: string): { value: number; stable: boolean; unit: string } | null => {
  try {
    const lines = data.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      console.log('📊 Analyzing scale line:', trimmed);
      
      let match = trimmed.match(/([ST|US]),([GS|NT]),([+-])(\d+\.?\d*)(kg|g|KG|G)/i) || 
                  trimmed.match(/([ST|US]),([GS|NT]),([+-])(\d+)(kg|g|KG|G)/i) ||
                  trimmed.match(/P,([+-])(\d+\.?\d*)(kg|g|KG|G)/i);
      
      if (!match) {
        match = trimmed.match(/([+-])?(\d+\.?\d*)(kg|g|KG|G)/i) || 
                trimmed.match(/([+-])?(\d+)(kg|g|KG|G)/i);
        if (match) {
          const [_, sign = '+', value, unit] = match;
          return {
            value: parseFloat(value) * (sign === '-' ? -1 : 1),
            stable: true,
            unit: unit.toLowerCase()
          };
        }
      }
      
      if (match) {
        let weight, stable, unit;
        
        if (match[0].startsWith('P,')) {
          const [, sign, value, unitValue] = match;
          weight = parseFloat(value) * (sign === '-' ? -1 : 1);
          stable = true;
          unit = unitValue.toLowerCase();
        } else {
          const [, status, type, sign, value, unitValue] = match;
          weight = parseFloat(value) * (sign === '-' ? -1 : 1);
          stable = status.toUpperCase() === 'ST';
          unit = unitValue.toLowerCase();
        }
        
        return {
          value: weight,
          stable: stable,
          unit: unit
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error parsing scale data:', error);
    return null;
  }
};