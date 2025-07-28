import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve essere utilizzato all\'interno di NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      data: new Date(),
      letta: false,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-rimuovi dopo 5 secondi se è di tipo success
    if (notification.tipo === 'transazione_generata') {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 5000);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, letta: true } : notif
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const addMultipleNotifications = useCallback((notificationsList) => {
    const newNotifications = notificationsList.map(notif => ({
      id: Date.now() + Math.random(),
      data: new Date(),
      letta: false,
      ...notif
    }));
    
    setNotifications(prev => [...newNotifications, ...prev]);
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(notif => !notif.letta).length;
  }, [notifications]);

  const getTodayNotifications = useCallback(() => {
    const today = new Date().toDateString();
    return notifications.filter(notif => 
      new Date(notif.data).toDateString() === today
    );
  }, [notifications]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    addMultipleNotifications,
    getUnreadCount,
    getTodayNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};