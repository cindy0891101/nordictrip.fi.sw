import { useEffect, useState } from 'react';

type SyncState = 'offline' | 'syncing' | 'online';

export default function SyncStatusBar() {
  const [state, setState] = useState<SyncState>('online');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) {
        setState('offline');
        setVisible(true);
      } else {
        setState('syncing');
        setVisible(true);

        // 模擬同步完成（之後可換成 Firebase 真事件）
        setTimeout(() => {
          setState('online');
          setTimeout(() => setVisible(false), 1200);
        }, 1000);
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!visible) return null;

  const config = {
    offline: {
      text: '離線模式 · 變更將於上線後同步',
      icon: 'fa-cloud-slash',
      bg: 'bg-paper',
      textColor: 'text-ink',
      glow: '',
    },
    syncing: {
      text: '正在同步資料…',
      icon: 'fa-arrows-rotate',
      bg: 'bg-harbor',
      textColor: 'text-white',
      glow: 'active-glow',
      spin: true,
    },
    online: {
      text: '已完成同步',
      icon: 'fa-check',
      bg: 'bg-sage',
      textColor: 'text-white',
      glow: '',
    },
  }[state];

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[92px] z-50 animate-in fade-in slide-in-from-bottom-2">
      <div
        className={`
          ${config.bg}
          ${config.textColor}
          ${config.glow}
          px-5 py-3 rounded-full
          shadow-lg
          flex items-center gap-3
          text-xs font-bold tracking-widest
        `}
      >
        <i
          className={`fa-solid ${config.icon} text-sm ${
            config.spin ? 'animate-spin' : ''
          }`}
        />
        <span>{config.text}</span>
      </div>
    </div>
  );
}