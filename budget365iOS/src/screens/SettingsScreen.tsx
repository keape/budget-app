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
import { API_URL } from '../config';

const BASE_URL = API_URL;

const SettingsScreen: React.FC = () => {
    const { logout, userToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'menu' | 'password' | 'about'>('menu');

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
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('password')}>
                <Text style={styles.menuItemText}>🔒 Change Password</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('about')}>
                <Text style={styles.menuItemText}>ℹ️ About Us</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
                <Text style={[styles.menuItemText, { color: '#DC2626' }]}>🗑️ Delete Account</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={logout}>
                <Text style={[styles.menuItemText, styles.logoutText]}>🚪 Logout</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPasswordChange = () => (
        <View style={styles.contentContainer}>
            <Text style={styles.title}>Change Password</Text>

            <Text style={styles.label}>Current Password</Text>
            <TextInput
                style={styles.input}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
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
        <ScrollView style={styles.contentContainer}>
            <Text style={styles.title}>About Budget365</Text>
            <Text style={styles.description}>
                Budget365 is your complete solution for personal finance management.
                Designed to be simple yet powerful, it helps you track your income and expenses intuitively.
            </Text>

            <View style={styles.section}>
                <Text style={styles.sectionHeader}>🎯 Our Goals</Text>
                <Text style={styles.listItem}>✓ Simple and accessible management</Text>
                <Text style={styles.listItem}>✓ Powerful tools without complexity</Text>
                <Text style={styles.listItem}>✓ Guaranteed security and privacy</Text>
            </View>

            <TouchableOpacity
                style={styles.section}
                onPress={() => Linking.openURL('https://various-sushi-3f4.notion.site/Budget365-Privacy-Policy-2e372b8820f88038a92ef83fedfd03d7')}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionHeader}>🔒 Privacy Policy</Text>
                    <Text style={{ fontSize: 18, color: '#4F46E5', fontWeight: 'bold' }}>↗️</Text>
                </View>
            </TouchableOpacity>

            <View style={styles.section}>
                <Text style={styles.sectionHeader}>✉️ Contact Us</Text>
                <Text style={styles.description}>
                    Have questions or suggestions? Email us at support@budget365.com
                </Text>
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { marginBottom: 40 }]} onPress={() => setActiveTab('menu')}>
                <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            {activeTab === 'menu' && renderMenu()}
            {activeTab === 'password' && renderPasswordChange()}
            {activeTab === 'about' && renderAbout()}
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
});

export default SettingsScreen;
