import React from "react";
import { MessageSquare } from "lucide-react";

interface ItemPedido {
  nome: string;
  quantidade: number;
}

interface ChatActionsProps {
  telefoneCliente: string;
  nomeCliente?: string;
  pedidoId: number;
  itens?: ItemPedido[]; // <-- agora opcional
  total?: number;
  pagamento?: string;
}

export function ChatActions({
  telefoneCliente,
  nomeCliente,
  pedidoId,
  itens = [],
  total = 0,
  pagamento = "Não informado"
}: ChatActionsProps) {
  const resumo =
    itens.length > 0
      ? itens.map(item => `- ${item.quantidade}x ${item.nome}`).join("\n")
      : "- Nenhum item encontrado";

  const mensagem = `
Olá ${nomeCliente || ""}, estou entrando em contato sobre seu pedido na loja.

Pedido #${pedidoId}
${resumo}
Total: R$ ${total.toFixed(2).replace(".", ",")}
Forma de pagamento: ${pagamento}
`;

  const whatsappLink = `https://wa.me/${telefoneCliente}?text=${encodeURIComponent(mensagem)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp do cliente"
        className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors flex items-center justify-center"
      >
        <MessageSquare size={20} />
      </a>
    </div>
  );
}
