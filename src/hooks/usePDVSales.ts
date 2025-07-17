@@ .. @@
 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '../lib/supabase';
 import { PDVProduct, PDVSale, PDVSaleItem, PDVOperator, PDVCartItem } from '../types/pdv';
+import { usePDVCashRegister } from './usePDVCashRegister';
 
 export const usePDVProducts = () => {
   const [products, setProducts] = useState<PDV}
Product[]>([]);
@@ .. @@
 export const usePDVSales = () => {
   const [sales, setSales] = useState<PDVSale[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
+  const { currentRegister, isOpen: isCashRegisterOpen } = usePDVCashRegister();
 
   const createSale = useCallback(async (
     saleData: Omit<PDVSale, 'id' | 'sale_number' | 'created_at' | 'updated_at'>,
@@ -118,6 +120,12 @@
   ) => {
     try {
       setLoading(true);
+      
+      // Check if cash register is open
+      if (!isCashRegisterOpen || !currentRegister) {
+        console.error('❌ Não é possível finalizar venda sem um caixa aberto');
+        throw new Error('Não é possível finalizar venda sem um caixa aberto');
+      }
 
       // Set channel to pdv if not specified
       const saleWithChannel = {
@@ -125,6 +133,9 @@
         channel: saleData.channel || 'pdv'
       };
       
+      // Associate with current cash register
+      saleWithChannel.cash_register_id = currentRegister.id;
+      
       if (debug) {
         console.log('🔍 Sale data:', saleWithChannel);
         console.log('🔍 Sale items:', items);
@@ -196,7 +207,7 @@
       console.error('❌ Sale creation failed:', errorMessage);
       throw new Error(errorMessage);
     } finally {
       setLoading(false);
     }
-  }, []);
+  }, [currentRegister, isCashRegisterOpen]);
 
   const cancelSale = useCallback(async (saleId: string, reason: string, operatorId: string) => {
     try {