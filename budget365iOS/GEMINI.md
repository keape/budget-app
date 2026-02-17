# GEMINI - Project Context & Rules

This file provides a clear overview of the **Budget365** project context for AI assistance.

## 🚀 Project Overview
**Budget365** is a mobile application (iOS & Android) built with **React Native** for managing personal finances (incomes and expenses).

---

## 🛠 Technology Stack
- **Framework**: React Native 0.80.2
- **Language**: TypeScript
- **Navigation**: React Navigation 7 (Native Stack & Bottom Tabs)
- **Security**: 
  - JWT Authentication (Bearer token in AsyncStorage)
  - Google Sign-In (`@react-native-google-signin/google-signin`)
  - Apple Authentication (`@invertase/react-native-apple-authentication`)
- **Backend API**: `https://budget-app-cd5o.onrender.com`
- **Native**: 
  - iOS: Swift based `AppDelegate`, uses CocoaPods.
  - Android: Kotlin based.

---

## 📁 Key Project Structure
- `src/screens/`: Main application screens (Home, Transactions, Budget, Stats, Settings, Auth).
- `src/context/`: State management (AuthContext, SettingsContext).
- `src/assets/`: App-specific assets (Logo, etc.).
- `ios/`: Native iOS project files, including `Images.xcassets` and `ci_scripts`.
- `android/`: Native Android project files.
- `app.json` / `package.json`: Main app configuration.

---

## 🔑 Core Features & Business Logic
- **Transaction Management**: One-time or periodic expenses/incomes.
- **Budgeting**: User-defined budgets per category vs. actual spending.
- **Reporting**: Monthly/Annual summaries and visual statistics.
- **Dark Mode**: Configurable via `SettingsContext`.

---

## 🏗 Build & Deployment
- **Versioning**: Managed via Apple Generic Versioning (`agvtool`).
- **iOS CI/CD**: Configured for **Xcode Cloud** (see `ios/ci_scripts/ci_post_clone.sh`).
- **App Store Connect**: Pushing to `main` branch triggers automatic builds.

---

## 📝 Coding Guidelines
- **UI**: Uses native Components (View, Text, Image) with `StyleSheet`. Consistent branding with Indigo (#4F46E5).
- **Icons**: Emoji placeholders are often used for quick UI, but `src/assets/logo.png` is the primary app brand.
- **API Calls**: Managed via standard `fetch` with Bearer token authentication.

---

## ⚠️ Important Notes
- The iOS bundle identifier is `com.keape.budget365`.
- The Android package name is `com.budget365`.
- Always verify `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` before sending to production.
