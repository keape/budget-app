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

const SettingsScreen: React.FC = () => {
    const { logout, userToken } = useAuth();
    const { theme, setTheme, currency, setCurrency, showBalance, setShowBalance, isDarkMode } = useSettings();
    const [activeTab, setActiveTab] = useState<'menu' | 'password' | 'about' | 'customization' | 'email' | 'bug'>('menu');

    // Profile Settings State
    const [email, setEmail] = useState('');

    // Bug Report State
    const [bugDescription, setBugDescription] = useState('');

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);


    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'New password must be at least 6 characters long');
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
                Alert.alert('Success', 'Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setActiveTab('menu');
            } else {
                Alert.alert('Error', data.message || 'Error changing password');
            }
        } catch (error) {
            Alert.alert('Error', 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            '⚠️ Warning',
            'Are you sure you want to delete your account? This action is IRREVERSIBLE and all your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
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
                Alert.alert('Account Deleted', 'Your account and all data have been removed.');
                logout();
            } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Unable to delete account');
            }
        } catch (error) {
            Alert.alert('Error', 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderMenu = () => (
        <View style={styles.menuContainer}>
            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('email')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>📧 Link Email</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('password')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>🔒 Change Password</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('customization')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>🎨 App Customization</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('about')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>ℹ️ About Us</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={() => setActiveTab('bug')}>
                <Text style={[styles.menuItemText, isDarkMode && { color: '#E5E7EB' }]}>🐛 Report a Bug</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, isDarkMode && { backgroundColor: '#1F2937' }]} onPress={handleDeleteAccount}>
                <Text style={[styles.menuItemText, { color: '#DC2626' }]}>🗑️ Delete Account</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.logoutButton, isDarkMode && { backgroundColor: '#450a0a', borderColor: '#7f1d1d' }]} onPress={logout}>
                <Text style={[styles.menuItemText, styles.logoutText, isDarkMode && { color: '#ef4444' }]}>🚪 Logout</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPasswordChange = () => (
        <View style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>Change Password</Text>

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Current Password</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>New Password</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Confirm New Password</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
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
                    <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );

    const renderAbout = () => (
        <ScrollView style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>About Budget 365</Text>
            <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }]}>
                Budget 365 is your complete solution for personal finance management.
                Designed to be simple yet powerful, it helps you track your income and expenses intuitively.
            </Text>

            <View style={[styles.section, isDarkMode && { borderBottomColor: '#374151' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>🎯 Our Goals</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>✓ Simple and accessible management</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>✓ Powerful tools without complexity</Text>
                <Text style={[styles.listItem, isDarkMode && { color: '#E5E7EB' }]}>✓ Guaranteed security and privacy</Text>
            </View>

            <TouchableOpacity
                style={[styles.section, isDarkMode && { borderBottomColor: '#374151' }]}
                onPress={() => Linking.openURL('https://various-sushi-3f4.notion.site/Budget365-Privacy-Policy-2e372b8820f88038a92ef83fedfd03d7')}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>🔒 Privacy Policy</Text>
                    <Text style={{ fontSize: 18, color: '#4F46E5', fontWeight: 'bold' }}>↗️</Text>
                </View>
            </TouchableOpacity>

            <View style={[styles.section, isDarkMode && { borderBottomColor: '#374151' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>✉️ Contact Us</Text>
                <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }]}>
                    Have questions or suggestions? Email us at keape@me.com
                </Text>
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 40 }]} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderCustomization = () => (
        <ScrollView style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>App Customization</Text>

            {/* Theme Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>🌓 Theme</Text>
                <View style={styles.optionsRow}>
                    {(['light', 'dark', 'system'] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.optionBtn, isDarkMode && { backgroundColor: '#374151', borderColor: '#4B5563' }, theme === t && styles.activeOptionBtn]}
                            onPress={() => setTheme(t)}
                        >
                            <Text style={[styles.optionBtnText, isDarkMode && { color: '#9CA3AF' }, theme === t && styles.activeOptionBtnText]}>
                                {t.charAt(0) + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Currency Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>💰 Currency</Text>
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

            {/* Privacy Section */}
            <View style={[styles.section, isDarkMode && { backgroundColor: '#1F2937' }]}>
                <Text style={[styles.sectionHeader, isDarkMode && { color: '#F3F4F6' }]}>🛡️ Privacy</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.description, isDarkMode && { color: '#D1D5DB' }, { marginBottom: 0 }]}>Show Balance on Dashboard</Text>
                    <TouchableOpacity
                        style={[styles.toggleBtn, showBalance && styles.activeToggleBtn, isDarkMode && !showBalance && { backgroundColor: '#4B5563' }]}
                        onPress={() => setShowBalance(!showBalance)}
                    >
                        <View style={[styles.toggleCircle, showBalance && styles.activeToggleCircle]} />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 40 }]} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const handleUpdateEmail = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter an email address');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/update-email`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (response.ok) {
                Alert.alert('Success', 'Email updated successfully');
                setActiveTab('menu');
            } else {
                Alert.alert('Error', data.message || 'Failed to update email');
            }
        } catch (error) {
            Alert.alert('Error', 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderEmailUpdate = () => (
        <View style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>Email Settings</Text>
            <Text style={[styles.description, isDarkMode && { color: '#9CA3AF' }]}>
                Adding an email allows you to recover your account and log in more securely.
            </Text>

            <Text style={[styles.label, isDarkMode && { color: '#E5E7EB' }]}>Email Address</Text>
            <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleUpdateEmail}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.primaryButtonText}>Save Email</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );

    const handleSendBugReport = async () => {
        if (!bugDescription.trim()) {
            Alert.alert('Error', 'Please describe the bug');
            return;
        }

        const subject = encodeURIComponent('Bug Report - Budget365');
        const body = encodeURIComponent(bugDescription);
        const mailtoUrl = `mailto:keape@me.com?subject=${subject}&body=${body}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);

            if (!canOpen) {
                Alert.alert(
                    'No Email Client',
                    'Available email client not found. If you are on a simulator, this is expected. Please email keape@me.com directly.'
                );
                return;
            }

            await Linking.openURL(mailtoUrl);
            setActiveTab('menu');
            setBugDescription('');
        } catch (err) {
            Alert.alert(
                'Error',
                'Could not open email client. Please email keape@me.com directly.'
            );
            console.error('An error occurred', err);
        }
    };

    const renderBugReport = () => (
        <View style={[styles.contentContainer, isDarkMode && { backgroundColor: '#111827' }]}>
            <Text style={[styles.title, isDarkMode && { color: '#818CF8' }]}>Report a Bug</Text>
            <Text style={[styles.description, isDarkMode && { color: '#9CA3AF' }]}>
                Found an issue? Let us know so we can fix it!
            </Text>

            <TextInput
                style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }]}
                multiline
                numberOfLines={6}
                value={bugDescription}
                onChangeText={setBugDescription}
                placeholder="Describe the bug here..."
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                textAlignVertical="top"
            />

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendBugReport}
            >
                <Text style={styles.primaryButtonText}>Send Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, isDarkMode && { backgroundColor: '#111827' }]}>
            {activeTab === 'menu' && renderMenu()}
            {activeTab === 'password' && renderPasswordChange()}
            {activeTab === 'about' && renderAbout()}
            {activeTab === 'customization' && renderCustomization()}
            {activeTab === 'email' && renderEmailUpdate()}
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
});

export default SettingsScreen;
