import { useState, useEffect } from "react";

export function PDVChatSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundUrl, setSoundUrl] = useState("/sounds/message.mp3");
  const [volume, setVolume] = useState(80);
  const [showNotifications, setShowNotifications] = useState(true);
  const [retryTimeout, setRetryTimeout] = useState(2000);

  useEffect(() => {
    const saved = localStorage.getItem("chatSettings");
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        setSoundEnabled(cfg.soundEnabled ?? true);
        setSoundUrl(cfg.soundUrl ?? "/sounds/message.mp3");
        setVolume(cfg.volume ?? 80);
        setShowNotifications(cfg.showNotifications ?? true);
        setRetryTimeout(cfg.retryTimeout ?? 2000);
      } catch (err) {
        console.warn("Erro ao carregar configurações do chat:", err);
      }
    }
  }, []);

  const save = () => {
    localStorage.setItem(
      "chatSettings",
      JSON.stringify({ soundEnabled, soundUrl, volume, showNotifications, retryTimeout })
    );
    alert("Configurações do chat salvas!");
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-semibold">Configurações do Chat</h2>

      <label className="flex items-center space-x-2">
        <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
        <span>Ativar som de nova mensagem</span>
      </label>

      <div>
        <label className="block text-sm font-medium">URL do som:</label>
        <input
          type="text"
          value={soundUrl}
          onChange={e => setSoundUrl(e.target.value)}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Volume (%):</label>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={e => setVolume(Number(e.target.value))}
        />
        <span>{volume}%</span>
      </div>

      <label className="flex items-center space-x-2">
        <input type="checkbox" checked={showNotifications} onChange={e => setShowNotifications(e.target.checked)} />
        <span>Mostrar notificações visuais</span>
      </label>

      <div>
        <label className="block text-sm font-medium">Tempo de auto-recarregamento (ms):</label>
        <input
          type="number"
          value={retryTimeout}
          onChange={e => setRetryTimeout(Number(e.target.value))}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      <button onClick={save} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
        Salvar
      </button>
    </div>
  );
}

export default PDVChatSettings;