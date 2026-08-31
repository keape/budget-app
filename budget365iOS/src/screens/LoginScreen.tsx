import React, { useState, useEffect } from 'react';
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
import { warmupBackend } from '../utils/apiClient';

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';

const BASE_URL = API_URL;

const STRINGS = {
  it: {
    loginFailedTitle: 'Accesso fallito',
    socialLoginError: 'Errore durante l\'accesso social',
    errorTitle: 'Errore',
    networkSocialLoginError: 'Errore di rete durante l\'accesso social',
    googlePlayServicesUnavailable: 'Google Play Services non disponibile',
    googleSignInFailed: 'Accesso con Google non riuscito',
    appleSignInFailed: 'Accesso con Apple non riuscito',
    enterCredentials: 'Inserisci email/nome utente e password',
    invalidCredentials: 'Credenziali non valide',
    networkErrorTitle: 'Errore di rete',
    networkErrorMessage: 'Impossibile connettersi al server. Controlla la tua connessione a internet e riprova.',
    subtitle: 'Accedi al tuo account',
    identifierPlaceholder: 'Email o nome utente',
    passwordPlaceholder: 'Password',
    loginButton: 'Accedi',
    divider: 'OPPURE',
    signInWithGoogle: 'Accedi con Google',
    signInWithApple: 'Accedi con Apple',
    registerLink: 'Non hai un account? Registrati',
  },
  en: {
    loginFailedTitle: 'Login Failed',
    socialLoginError: 'Error during social login',
    errorTitle: 'Error',
    networkSocialLoginError: 'Network error during social login',
    googlePlayServicesUnavailable: 'Google Play Services not available',
    googleSignInFailed: 'Google Sign-In failed',
    appleSignInFailed: 'Apple Sign-In failed',
    enterCredentials: 'Enter email/username and password',
    invalidCredentials: 'Invalid credentials',
    networkErrorTitle: 'Network Error',
    networkErrorMessage: 'The app could not connect to the server. Please check your internet connection and try again.',
    subtitle: 'Log in to your account',
    identifierPlaceholder: 'Email or Username',
    passwordPlaceholder: 'Password',
    loginButton: 'Login',
    divider: 'OR',
    signInWithGoogle: 'Sign in with Google',
    signInWithApple: 'Sign in with Apple',
    registerLink: 'Don\'t have an account? Register',
  },
  es: {
    loginFailedTitle: 'Error al iniciar sesión',
    socialLoginError: 'Error durante el inicio de sesión social',
    errorTitle: 'Error',
    networkSocialLoginError: 'Error de red durante el inicio de sesión social',
    googlePlayServicesUnavailable: 'Google Play Services no disponible',
    googleSignInFailed: 'Error al iniciar sesión con Google',
    appleSignInFailed: 'Error al iniciar sesión con Apple',
    enterCredentials: 'Introduce email/nombre de usuario y contraseña',
    invalidCredentials: 'Credenciales no válidas',
    networkErrorTitle: 'Error de red',
    networkErrorMessage: 'No se pudo conectar con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo.',
    subtitle: 'Accede a tu cuenta',
    identifierPlaceholder: 'Email o nombre de usuario',
    passwordPlaceholder: 'Contraseña',
    loginButton: 'Acceder',
    divider: 'O',
    signInWithGoogle: 'Iniciar sesión con Google',
    signInWithApple: 'Iniciar sesión con Apple',
    registerLink: '¿No tienes una cuenta? Regístrate',
  },
};

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const { isDarkMode, language } = useSettings();
  const t = STRINGS[language];
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      iosClientId: '717541750569-brfd9c3iig0l09id6bs6l2i99t8r082c.apps.googleusercontent.com',
    });
    warmupBackend(); // sveglia il backend mentre l'utente inserisce le credenziali
  }, []);

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
        Alert.alert(t.loginFailedTitle, data.message || t.socialLoginError);
      }
    } catch (error) {
      console.error('Social Login Error:', error);
      Alert.alert(t.errorTitle, t.networkSocialLoginError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = userInfo.data || {};

      if (!idToken) {
        throw new Error('Google Sign-In failed - no ID token returned');
      }

      await socialLogin({
        provider: 'google',
        idToken,
      });
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return;
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(t.errorTitle, t.googlePlayServicesUnavailable);
      } else {
        console.error('Google Login Logic Error:', error);
        Alert.alert(t.errorTitle, t.googleSignInFailed);
      }
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
      Alert.alert(t.errorTitle, t.appleSignInFailed);
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert(t.errorTitle, t.enterCredentials);
      return;
    }

    setIsLoading(true);
    let attempts = 0;
    const maxAttempts = 3;

    const attemptLogin = async (): Promise<boolean> => {
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
          Alert.alert(t.loginFailedTitle, data.message || t.invalidCredentials);
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
          t.networkErrorTitle,
          t.networkErrorMessage
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
          <Text style={[styles.title, isDarkMode && { color: '#4ADE80' }]}>Budget 365</Text>
          <Text style={[styles.subtitle, isDarkMode && { color: '#9CA3AF' }]}>{t.subtitle}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
              placeholder={t.identifierPlaceholder}
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
              placeholder={t.passwordPlaceholder}
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
              <Text style={styles.loginButtonText}>{t.loginButton}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, isDarkMode && { backgroundColor: '#374151' }]} />
            <Text style={[styles.dividerText, isDarkMode && { color: '#9CA3AF' }]}>{t.divider}</Text>
            <View style={[styles.divider, isDarkMode && { backgroundColor: '#374151' }]} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: isDarkMode ? '#F9FAFB' : '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' }]}
            onPress={handleGoogleLogin}
          >
            <Text style={[styles.socialButtonText, { color: '#1F2937' }]}>{t.signInWithGoogle}</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: isDarkMode ? '#F9FAFB' : '#000000', marginTop: 12 }]}
              onPress={handleAppleLogin}
            >
              <Text style={[styles.socialButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>{t.signInWithApple}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.registerLinkText, isDarkMode && { color: '#4ADE80' }]}>
              {t.registerLink}
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
    color: '#163B2C',
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
    backgroundColor: '#163B2C',
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
    color: '#163B2C',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default LoginScreen;