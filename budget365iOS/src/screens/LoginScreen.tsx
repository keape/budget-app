import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';

import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import { appleAuth } from '@invertase/react-native-apple-authentication';

const BASE_URL = API_URL;

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const { isDarkMode } = useSettings();
  const [isLoading, setIsLoading] = useState(false);

  const socialLogin = async (payload: any) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/social-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await login(data.token, data.username || 'Social User');
      } else {
        Alert.alert('Login Failed', data.message || 'Error during social login');
      }
    } catch (error) {
      console.error('Social Login Error:', error);
      Alert.alert('Error', 'Network error during social login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      // Intentamos login con permisos básicos
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);

      if (result.isCancelled) {
        return;
      }

      const data = await AccessToken.getCurrentAccessToken();
      if (!data) {
        throw new Error('Something went wrong obtaining access token');
      }

      await socialLogin({
        provider: 'facebook',
        token: data.accessToken.toString(),
      });
    } catch (error) {
      console.error('Facebook Login Logic Error:', error);
      Alert.alert('Error', 'Facebook Login failed. Make sure you have configured your Info.plist correctly.');
    }
  };

  const handleAppleLogin = async () => {
    try {
      // performs login request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // get current authentication state for user
      // /!\ This step must be done on your own backend to ensure the token is valid
      const { identityToken, user } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      await socialLogin({
        provider: 'apple',
        idToken: identityToken,
        user: appleAuthRequestResponse
      });
    } catch (error: any) {
      if (error.code === appleAuth.Error.CANCELED) {
        return;
      }
      console.error('Apple Login Logic Error:', error);
      Alert.alert('Error', 'Apple Sign-In failed');
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'Enter email/username and password');
      return;
    }

    setIsLoading(true);
    let attempts = 0;
    const maxAttempts = 3;

    const attemptLogin = async () => {
      try {
        console.log(`Login attempt ${attempts + 1} for identifier: ${identifier}`);
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ identifier, password }),
        });

        const data = await response.json();

        if (response.ok && data.token) {
          // Note: The backend should ideally return the username/email in the payload or we decode it.
          // For now, if login is successful, we can use the identifier as a fallback or update backend to return user info.
          await login(data.token, identifier);
          return true;
        } else {
          Alert.alert('Login Failed', data.message || 'Invalid credentials');
          return true; // Don't retry on invalid credentials
        }
      } catch (error) {
        console.error(`Login attempt ${attempts + 1} error:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await attemptLogin();
        }
        Alert.alert(
          'Network Error',
          'The app could not connect to the server. Please check your internet connection and try again.'
        );
        return false;
      }
    };

    await attemptLogin();
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>Budget 365</Text>
          <Text style={[styles.subtitle, isDarkMode && { color: '#9CA3AF' }]}>Log in to your account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
              placeholder="Email or Username"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, isDarkMode && { backgroundColor: '#374151' }]} />
            <Text style={[styles.dividerText, isDarkMode && { color: '#9CA3AF' }]}>OR</Text>
            <View style={[styles.divider, isDarkMode && { backgroundColor: '#374151' }]} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: '#1877F2' }]}
            onPress={handleFacebookLogin}
          >
            <Text style={styles.socialButtonText}>Login with Facebook</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: isDarkMode ? '#F9FAFB' : '#000000', marginTop: 12 }]}
              onPress={handleAppleLogin}
            >
              <Text style={[styles.socialButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.registerLinkText, isDarkMode && { color: '#818CF8' }]}>
              Don't have an account? Register
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  loginButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loginButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  socialButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;