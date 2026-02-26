import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PeriodicTransactionsScreen from './src/screens/PeriodicTransactionsScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { isDarkMode } = useSettings();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: isDarkMode ? '#9CA3AF' : '#6B7280',
        tabBarStyle: {
          display: 'none',
        },
        headerStyle: {
          backgroundColor: isDarkMode ? '#111827' : '#4F46E5',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: () => (
          <Image
            source={require('./src/assets/logo.png')}
            style={{ width: 32, height: 32, marginLeft: 16, borderRadius: 8 }}
          />
        ),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color }}>💰</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={({ navigation }) => ({
          title: 'Search & Filter',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ marginLeft: 16 }}>
              <Text style={{ fontSize: 22, color: '#FFFFFF' }}>←</Text>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color }}>🔍</Text>
            </View>
          ),
        })}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={({ navigation }) => ({
          title: 'Budget',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ marginLeft: 16 }}>
              <Text style={{ fontSize: 22, color: '#FFFFFF' }}>←</Text>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color }}>📈</Text>
            </View>
          ),
        })}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={({ navigation }) => ({
          title: 'Stats',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ marginLeft: 16 }}>
              <Text style={{ fontSize: 22, color: '#FFFFFF' }}>←</Text>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color }}>📊</Text>
            </View>
          ),
        })}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const { isDarkMode } = useSettings();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, isDarkMode && { backgroundColor: '#111827' }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={{
                headerShown: true,
                title: 'New Transaction',
                headerStyle: { backgroundColor: isDarkMode ? '#111827' : '#4F46E5' },
                headerTintColor: '#fff'
              }}
            />

            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerShown: true,
                title: 'Settings',
                headerStyle: { backgroundColor: isDarkMode ? '#111827' : '#4F46E5' },
                headerTintColor: '#fff'
              }}
            />

            <Stack.Screen
              name="PeriodicTransactions"
              component={PeriodicTransactionsScreen}
              options={{
                headerShown: true,
                title: 'Recurring Transactions',
                headerStyle: { backgroundColor: isDarkMode ? '#111827' : '#4F46E5' },
                headerTintColor: '#fff'
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <AppNavigator />
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});

export default App;
