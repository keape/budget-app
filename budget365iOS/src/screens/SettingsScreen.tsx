import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Linking
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';

const BASE_URL = API_URL;

const STRINGS = {
    it: {
        errorTitle: 'Errore',
        fillAllFields: 'Compila tutti i campi',
        passwordMismatch: 'Le nuove password non coincidono',
        passwordTooShort: 'La nuova password deve avere almeno 6 caratteri',
        successTitle: 'Successo',
        passwordChanged: 'Password modificata con successo!',
        passwordChangeError: 'Errore durante la modifica della password',
        connectionError: 'Errore di connessione',
        deleteWarningTitle: '⚠️ Attenzione',
        deleteWarningMsg: "Sei sicuro di voler eliminare il tuo account? Questa azione è IRREVERSIBILE e tutti i tuoi dati verranno eliminati definitivamente.",
        cancel: 'Annulla',
        deleteForever: 'Elimina Definitivamente',
        accountDeletedTitle: 'Account Eliminato',
        accountDeletedMsg: 'Il tuo account e tutti i dati sono stati rimossi.',
        deleteAccountError: "Impossibile eliminare l'account",
        menuChangePassword: '🔒 Cambia Password',
        menuCustomization: '🎨 Personalizzazione App',
        menuAbout: 'ℹ️ Chi Siamo',
        menuBug: '🐛 Segnala un Bug',
        menuLogout: '🚪 Esci',
        changePasswordTitle: 'Cambia Password',
        currentPasswordLabel: 'Password Attuale',
        currentPasswordPlaceholder: 'Inserisci la password attuale',
        newPasswordLabel: 'Nuova Password',
        newPasswordPlaceholder: 'Inserisci la nuova password',
        confirmPasswordLabel: 'Conferma Nuova Password',
        confirmPasswordPlaceholder: 'Conferma la nuova password',
        updatePassword: 'Aggiorna Password',
        back: 'Indietro',
        aboutTitle: 'Chi è Budget 365',
        aboutDescription: 'Budget 365 è la tua soluzione completa per la gestione delle finanze personali. Progettata per essere semplice ma potente, ti aiuta a tenere traccia di entrate e uscite in modo intuitivo.',
        goalsHeader: '🎯 I Nostri Obiettivi',
        goal1: '✓ Gestione semplice e accessibile',
        goal2: '✓ Strumenti potenti senza complessità',
        goal3: '✓ Sicurezza e privacy garantite',
        privacyPolicyHeader: '🔒 Privacy Policy',
        contactHeader: '✉️ Contattaci',
        contactDescription: 'Domande o suggerimenti? Scrivici a keape@me.com',
        customizationTitle: 'Personalizzazione App',
        themeHeader: '🌓 Tema',
        themeLight: 'Chiaro',
        themeDark: 'Scuro',
        themeSystem: 'Sistema',
        currencyHeader: '💰 Valuta',
        languageHeader: '🌐 Lingua',
        privacyHeader: '🛡️ Privacy',
        showBalanceLabel: 'Mostra Saldo nella Dashboard',
        dangerZoneHeader: '⚠️ Zona Pericolosa',
        dangerZoneDescription: "L'eliminazione dell'account è permanente e rimuove tutti i tuoi dati.",
        deleteAccountBtn: '🗑️ Elimina Account',
        describeBug: 'Descrivi il bug',
        noEmailClientTitle: 'Nessun Client Email',
        noEmailClientMsg: 'Nessun client email disponibile trovato. Se sei su un simulatore, è normale. Scrivi direttamente a keape@me.com.',
        openEmailClientError: 'Impossibile aprire il client email. Scrivi direttamente a keape@me.com.',
        bugReportTitle: 'Segnala un Bug',
        bugReportDescription: 'Hai trovato un problema? Faccelo sapere così possiamo risolverlo!',
        bugPlaceholder: 'Descrivi qui il bug...',
        sendReport: 'Invia Segnalazione',
    },
    en: {
        errorTitle: 'Error',
        fillAllFields: 'Please fill in all fields',
        passwordMismatch: 'New passwords do not match',
        passwordTooShort: 'New password must be at least 6 characters long',
        successTitle: 'Success',
        passwordChanged: 'Password changed successfully!',
        passwordChangeError: 'Error changing password',
        connectionError: 'Connection error',
        deleteWarningTitle: '⚠️ Warning',
        deleteWarningMsg: 'Are you sure you want to delete your account? This action is IRREVERSIBLE and all your data will be permanently deleted.',
        cancel: 'Cancel',
        deleteForever: 'Delete Permanently',
        accountDeletedTitle: 'Account Deleted',
        accountDeletedMsg: 'Your account and all data have been removed.',
        deleteAccountError: 'Unable to delete account',
        menuChangePassword: '🔒 Change Password',
        menuCustomization: '🎨 App Customization',
        menuAbout: 'ℹ️ About Us',
        menuBug: '🐛 Report a Bug',
        menuLogout: '🚪 Logout',
        changePasswordTitle: 'Change Password',
        currentPasswordLabel: 'Current Password',
        currentPasswordPlaceholder: 'Enter current password',
        newPasswordLabel: 'New Password',
        newPasswordPlaceholder: 'Enter new password',
        confirmPasswordLabel: 'Confirm New Password',
        confirmPasswordPlaceholder: 'Confirm new password',
        updatePassword: 'Update Password',
        back: 'Back',
        aboutTitle: 'About Budget 365',
        aboutDescription: 'Budget 365 is your complete solution for personal finance management. Designed to be simple yet powerful, it helps you track your income and expenses intuitively.',
        goalsHeader: '🎯 Our Goals',
        goal1: '✓ Simple and accessible management',
        goal2: '✓ Powerful tools without complexity',
        goal3: '✓ Guaranteed security and privacy',
        privacyPolicyHeader: '🔒 Privacy Policy',
        contactHeader: '✉️ Contact Us',
        contactDescription: 'Have questions or suggestions? Email us at keape@me.com',
        customizationTitle: 'App Customization',
        themeHeader: '🌓 Theme',
        themeLight: 'Light',
        themeDark: 'Dark',
        themeSystem: 'System',
        currencyHeader: '💰 Currency',
        languageHeader: '🌐 Language',
        privacyHeader: '🛡️ Privacy',
        showBalanceLabel: 'Show Balance on Dashboard',
        dangerZoneHeader: '⚠️ Danger Zone',
        dangerZoneDescription: 'Deleting your account is permanent and removes all your data.',
        deleteAccountBtn: '🗑️ Delete Account',
        describeBug: 'Please describe the bug',
        noEmailClientTitle: 'No Email Client',
        noEmailClientMsg: 'Available email client not found. If you are on a simulator, this is expected. Please email keape@me.com directly.',
        openEmailClientError: 'Could not open email client. Please email keape@me.com directly.',
        bugReportTitle: 'Report a Bug',
        bugReportDescription: 'Found an issue? Let us know so we can fix it!',
        bugPlaceholder: 'Describe the bug here...',
        sendReport: 'Send Report',
    },
} as const;

const SettingsScreen: React.FC = () => {
    const { logout, userToken } = useAuth();
    const { theme, setTheme, currency, setCurrency, showBalance, setShowBalance, language, setLanguage, isDarkMode } = useSettings();
    const t = STRINGS[language];
    const [activeTab, setActiveTab] = useState<'menu' | 'password' | 'about' | 'customization' | 'bug'>('menu');

    // Bug Report State
    const [bugDescription, setBugDescription] = useState('');

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);


    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert(t.errorTitle, t.fillAllFields);
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert(t.errorTitle, t.passwordMismatch);
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert(t.errorTitle, t.passwordTooShort);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert(t.successTitle, t.passwordChanged);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setActiveTab('menu');
            } else {
                Alert.alert(t.errorTitle, data.message || t.passwordChangeError);
            }
        } catch (error) {
            Alert.alert(t.errorTitle, t.connectionError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t.deleteWarningTitle,
            t.deleteWarningMsg,
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.deleteForever,
                    style: 'destructive',
                    onPress: confirmDeleteAccount
                }
            ]
        );
    };

    const confirmDeleteAccount = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/auth/delete-account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                Alert.alert(t.accountDeletedTitle, t.accountDeletedMsg);
                logout();
            } else {
                const data = await response.json();
                Alert.alert(t.errorTitle, data.message || t.deleteAccountError);
            }
        } catch (error) {
            Alert.alert(t.errorTitle, t.connectionError);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMenu = () => (
        <View style={styles.menuContainer}>
            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('password')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>{t.menuChangePassword}</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('customization')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>{t.menuCustomization}</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('about')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>{t.menuAbout}</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('bug')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>{t.menuBug}</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.logoutButton, isDarkMode && { backgroundColor: '#450a0a', borderColor: '#7f1d1d' }]} onPress={logout}>
                <Text style={[styles.menuItemText, styles.logoutText, isDarkMode && { color: '#ef4444' }]}>{t.menuLogout}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPasswordChange = () => (
        <View style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>{t.changePasswordTitle}</Text>

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.currentPasswordLabel}</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={t.currentPasswordPlaceholder}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.newPasswordLabel}</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t.newPasswordPlaceholder}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>{t.confirmPasswordLabel}</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t.confirmPasswordPlaceholder}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.primaryButtonText}>{t.updatePassword}</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>{t.back}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderAbout = () => (
        <ScrollView style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>{t.aboutTitle}</Text>
            <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }]}>
                {t.aboutDescription}
            </Text>

            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937', borderBottomColor: '#374151' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.goalsHeader}</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>{t.goal1}</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>{t.goal2}</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>{t.goal3}</Text>
            </View>

            <TouchableOpacity
                style={[styles.section, isDarkMode && { backgroundColor: '#1F2937', borderBottomColor: '#374151' }]}
                onPress={() => Linking.openURL('https://various-sushi-3f4.notion.site/Budget365-Privacy-Policy-2e372b8820f88038a92ef83fedfd03d7')}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.privacyPolicyHeader}</Text>
                    <Text style={{ fontSize: 18, color: '#4F46E5', fontWeight: 'bold' }}>↗️</Text>
                </View>
            </TouchableOpacity>

            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937', borderBottomColor: '#374151' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.contactHeader}</Text>
                <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }]}>
                    {t.contactDescription}
                </Text>
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 40 }]} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>{t.back}</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderCustomization = () => (
        <ScrollView style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>{t.customizationTitle}</Text>

            {/* Theme Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.themeHeader}</Text>
                <View style={styles.optionsRow}>
                    {(['light', 'dark', 'system'] as const).map((themeOption) => (
                        <TouchableOpacity
                            key={themeOption}
                            style={[styles.optionBtn, isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' }, theme === themeOption && styles.activeOptionBtn]}
                            onPress={() => setTheme(themeOption)}
                        >
                            <Text style={[styles.optionBtnText, isDarkMode && { color: '#9CA3AF' }, theme === themeOption && styles.activeOptionBtnText]}>
                                {themeOption === 'light' ? t.themeLight : themeOption === 'dark' ? t.themeDark : t.themeSystem}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Currency Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.currencyHeader}</Text>
                <View style={styles.optionsRow}>
                    {(['€', '$', '£'] as const).map((c) => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.optionBtn, isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' }, currency === c && styles.activeOptionBtn]}
                            onPress={() => setCurrency(c)}
                        >
                            <Text style={[styles.optionBtnText, isDarkMode && { color: '#9CA3AF' }, currency === c && styles.activeOptionBtnText]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Language Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.languageHeader}</Text>
                <View style={styles.optionsRow}>
                    {([{ code: 'it' as const, label: '🇮🇹 Italiano' }, { code: 'en' as const, label: '🇬🇧 English' }]).map(({ code, label }) => (
                        <TouchableOpacity
                            key={code}
                            style={[styles.optionBtn, isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' }, language === code && styles.activeOptionBtn]}
                            onPress={() => setLanguage(code)}
                        >
                            <Text style={[styles.optionBtnText, isDarkMode && { color: '#9CA3AF' }, language === code && styles.activeOptionBtnText]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Privacy Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.privacyHeader}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }, { marginBottom: 0 }]}>{t.showBalanceLabel}</Text>
                    <TouchableOpacity
                        style={[styles.toggleBtn, showBalance && styles.activeToggleBtn, isDarkMode && !showBalance && { backgroundColor: '#4B5563' }]}
                        onPress={() => setShowBalance(!showBalance)}
                    >
                        <View style={[styles.toggleCircle, showBalance && styles.activeToggleCircle]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Danger Zone */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>{t.dangerZoneHeader}</Text>
                <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }]}>
                    {t.dangerZoneDescription}
                </Text>
                <TouchableOpacity
                    style={[styles.dangerButton, isDarkMode && { backgroundColor: '#450a0a', borderColor: '#7f1d1d' }]}
                    onPress={handleDeleteAccount}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#DC2626" />
                    ) : (
                        <Text style={styles.dangerButtonText}>{t.deleteAccountBtn}</Text>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 40 }]} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>{t.back}</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const handleSendBugReport = async () => {
        if (!bugDescription.trim()) {
            Alert.alert(t.errorTitle, t.describeBug);
            return;
        }

        const subject = encodeURIComponent('Bug Report - Budget365');
        const body = encodeURIComponent(bugDescription);
        const mailtoUrl = `mailto:keape@me.com?subject=${subject}&body=${body}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);

            if (!canOpen) {
                Alert.alert(
                    t.noEmailClientTitle,
                    t.noEmailClientMsg
                );
                return;
            }

            await Linking.openURL(mailtoUrl);
            setActiveTab('menu');
            setBugDescription('');
        } catch (err) {
            Alert.alert(
                t.errorTitle,
                t.openEmailClientError
            );
            console.error('An error occurred', err);
        }
    };

    const renderBugReport = () => (
        <View style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>{t.bugReportTitle}</Text>
            <Text style={[styles.description, isDarkMode && { color: '#9CA3AF' }]}>
                {t.bugReportDescription}
            </Text>

            <TextInput
                style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                multiline
                numberOfLines={6}
                value={bugDescription}
                onChangeText={setBugDescription}
                placeholder={t.bugPlaceholder}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                textAlignVertical="top"
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendBugReport}
            >
                <Text style={styles.primaryButtonText}>{t.sendReport}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>{t.back}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
            {activeTab === 'menu' && renderMenu()}
            {activeTab === 'password' && renderPasswordChange()}
            {activeTab === 'about' && renderAbout()}
            {activeTab === 'customization' && renderCustomization()}
            {activeTab === 'bug' && renderBugReport()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    menuContainer: {
        padding: 20,
    },
    menuItem: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    menuItemText: {
        fontSize: 18,
        color: '#374151',
        fontWeight: '500',
    },
    chevron: {
        fontSize: 24,
        color: '#9CA3AF',
    },
    logoutButton: {
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        backgroundColor: '#FEF2F2',
    },
    logoutText: {
        color: '#DC2626',
        fontWeight: 'bold',
    },
    contentContainer: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    textArea: {
        height: 150,
        textAlignVertical: 'top',
    },
    primaryButton: {
        backgroundColor: '#4F46E5',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    secondaryButtonText: {
        color: '#6B7280',
        fontSize: 16,
        fontWeight: '600',
    },
    description: {
        fontSize: 16,
        color: '#4B5563',
        lineHeight: 24,
        marginBottom: 20,
    },
    section: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    listItem: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    optionBtn: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    activeOptionBtn: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    optionBtnText: {
        color: '#374151',
        fontWeight: '600',
    },
    activeOptionBtnText: {
        color: 'white',
    },
    toggleBtn: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D1D5DB',
        padding: 2,
    },
    activeToggleBtn: {
        backgroundColor: '#4F46E5',
    },
    toggleCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
        transform: [{ translateX: 0 }],
    },
    activeToggleCircle: {
        transform: [{ translateX: 22 }],
    },
    dangerButton: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    dangerButtonText: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SettingsScreen;
