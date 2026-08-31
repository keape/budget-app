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

import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';
import { warmupBackend } from '../utils/apiClient';

const BASE_URL = API_URL;

const STRINGS = {
  it: {
    errorTitle: 'Errore',
    fillAllFields: 'Compila tutti i campi',
    passwordsMismatch: 'Le password non coincidono',
    passwordTooShort: 'La password deve contenere almeno 6 caratteri',
    successTitle: 'Successo',
    otpSent: 'Codice di verifica inviato alla tua email.',
    otpSendFailed: 'Invio del codice di verifica non riuscito',
    networkError: 'Errore di rete. Riprova più tardi.',
    enterOtp: 'Inserisci il codice di verifica',
    accountCreated: 'Account creato con successo! Ora puoi accedere.',
    registrationError: 'Errore durante la registrazione',
    createAccountTitle: 'Crea il tuo account',
    verifyEmailTitle: 'Verifica Email',
    usernamePlaceholder: 'Nome utente',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Conferma password',
    nextButton: 'Avanti',
    otpSentTo: 'Abbiamo inviato un codice di verifica a:',
    otpPlaceholder: 'Inserisci il codice di verifica',
    registerButton: 'Registrati',
    backButton: 'Indietro',
    haveAccount: 'Hai già un account? Accedi',
  },
  en: {
    errorTitle: 'Error',
    fillAllFields: 'Please fill in all fields',
    passwordsMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters long',
    successTitle: 'Success',
    otpSent: 'Verification code sent to your email.',
    otpSendFailed: 'Failed to send verification code',
    networkError: 'Network error. Please try again later.',
    enterOtp: 'Please enter the verification code',
    accountCreated: 'Account created successfully! You can now log in.',
    registrationError: 'Error during registration',
    createAccountTitle: 'Create your account',
    verifyEmailTitle: 'Verify Email',
    usernamePlaceholder: 'Username',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm Password',
    nextButton: 'Next',
    otpSentTo: 'We have sent a verification code to:',
    otpPlaceholder: 'Enter Verification Code',
    registerButton: 'Register',
    backButton: 'Back',
    haveAccount: 'Already have an account? Login',
  },
  es: {
    errorTitle: 'Error',
    fillAllFields: 'Completa todos los campos',
    passwordsMismatch: 'Las contraseñas no coinciden',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres',
    successTitle: 'Éxito',
    otpSent: 'Código de verificación enviado a tu email.',
    otpSendFailed: 'Error al enviar el código de verificación',
    networkError: 'Error de red. Inténtalo de nuevo más tarde.',
    enterOtp: 'Introduce el código de verificación',
    accountCreated: 'Cuenta creada con éxito. Ahora puedes iniciar sesión.',
    registrationError: 'Error durante el registro',
    createAccountTitle: 'Crea tu cuenta',
    verifyEmailTitle: 'Verificar Email',
    usernamePlaceholder: 'Nombre de usuario',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Contraseña',
    confirmPasswordPlaceholder: 'Confirmar contraseña',
    nextButton: 'Siguiente',
    otpSentTo: 'Hemos enviado un código de verificación a:',
    otpPlaceholder: 'Introduce el código de verificación',
    registerButton: 'Registrarse',
    backButton: 'Atrás',
    haveAccount: '¿Ya tienes una cuenta? Inicia sesión',
  },
};

interface RegisterScreenProps {
  navigation: any;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const { isDarkMode, language } = useSettings();
  const t = STRINGS[language];
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    warmupBackend(); // sveglia il backend mentre l'utente compila il form
  }, []);

  const handleSendOtp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert(t.errorTitle, t.fillAllFields);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t.errorTitle, t.passwordsMismatch);
      return;
    }

    if (password.length < 6) {
      Alert.alert(t.errorTitle, t.passwordTooShort);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2);
        Alert.alert(t.successTitle, t.otpSent);
      } else {
        Alert.alert(t.errorTitle, data.message || t.otpSendFailed);
      }
    } catch (error) {
      console.error('OTP error:', error);
      Alert.alert(t.errorTitle, t.networkError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!otp) {
      Alert.alert(t.errorTitle, t.enterOtp);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          t.successTitle,
          t.accountCreated,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert(t.errorTitle, data.message || t.registrationError);
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert(t.errorTitle, t.networkError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && { color: '#4ADE80' }]}>Budget 365</Text>
          <Text style={[styles.subtitle, isDarkMode && { color: '#9CA3AF' }]}>
            {step === 1 ? t.createAccountTitle : t.verifyEmailTitle}
          </Text>
        </View>

        <View style={styles.form}>
          {step === 1 ? (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
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

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                  placeholder={t.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.registerButtonText}>{t.nextButton}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ textAlign: 'center', marginBottom: 20, color: isDarkMode ? '#D1D5DB' : '#4B5563' }}>
                {t.otpSentTo}{'\n'}
                <Text style={{ fontWeight: 'bold' }}>{email}</Text>
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                  placeholder={t.otpPlaceholder}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.registerButtonText}>{t.registerButton}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => setStep(1)}
                disabled={isLoading}
              >
                <Text style={[styles.loginLinkText, isDarkMode && { color: '#4ADE80' }]}>
                  {t.backButton}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginLinkText, isDarkMode && { color: '#4ADE80' }]}>
              {t.haveAccount}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  registerButton: {
    backgroundColor: '#163B2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  registerButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    color: '#163B2C',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default RegisterScreen;