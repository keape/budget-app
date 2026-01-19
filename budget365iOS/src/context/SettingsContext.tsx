import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark' | 'system';
type Currency = '€' | '$' | '£';

interface SettingsContextType {
    theme: Theme;
    currency: Currency;
    showBalance: boolean;
    setTheme: (theme: Theme) => void;
    setCurrency: (currency: Currency) => void;
    setShowBalance: (show: boolean) => void;
    isDarkMode: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<Theme>('system');
    const [currency, setCurrencyState] = useState<Currency>('€');
    const [showBalance, setShowBalanceState] = useState<boolean>(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app_theme');
            const savedCurrency = await AsyncStorage.getItem('app_currency');
            const savedShowBalance = await AsyncStorage.getItem('app_show_balance');

            if (savedTheme) setThemeState(savedTheme as Theme);
            if (savedCurrency) setCurrencyState(savedCurrency as Currency);
            if (savedShowBalance) setShowBalanceState(savedShowBalance === 'true');
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem('app_theme', newTheme);
    };

    const setCurrency = async (newCurrency: Currency) => {
        setCurrencyState(newCurrency);
        await AsyncStorage.setItem('app_currency', newCurrency);
    };

    const setShowBalance = async (show: boolean) => {
        setShowBalanceState(show);
        await AsyncStorage.setItem('app_show_balance', String(show));
    };

    const isDarkMode = theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';

    return (
        <SettingsContext.Provider value={{
            theme,
            currency,
            showBalance,
            setTheme,
            setCurrency,
            setShowBalance,
            isDarkMode
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
