import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationBar = () => {
  const { getTodayNotifications, removeNotification, markAsRead } = useNotifications();
  const todayNotifications = getTodayNotifications();

  if (todayNotifications.length === 0) return null;

  return (
    <div className="notification-container mb-6">
      {todayNotifications.slice(0, 3).map(notification => (
        <div
          key={notification.id}
          className={`notification-item flex items-center justify-between p-4 mb-2 rounded-lg shadow-md transition-all duration-300 ${
            notification.tipo === 'transazione_generata'
              ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500'
              : notification.tipo === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
              : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
          } ${!notification.letta ? 'shadow-lg' : 'opacity-75'}`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">
              {notification.icona || '📱'}
            </span>
            <div>
              <p className={`font-medium ${
                notification.tipo === 'transazione_generata'
                  ? 'text-green-800 dark:text-green-200'
                  : notification.tipo === 'error'
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-blue-800 dark:text-blue-200'
              }`}>
                {notification.messaggio}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(notification.data).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!notification.letta && (
              <button
                onClick={() => markAsRead(notification.id)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                title="Segna come letta"
              >
                ✓
              </button>
            )}
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              title="Rimuovi notifica"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      
      {todayNotifications.length > 3 && (
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ... e altre {todayNotifications.length - 3} notifiche
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationBar;