// Supabase client for Where Buy (Expo / React Native / Expo Snack).
// Use the project's publishable key only. Never put a service_role key in a mobile app.
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxxgalwnwdkdicadaxvn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_60ymT29Ssi3hNCFGenjdXw_WhRmZQXd';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'إعدادات Supabase غير مكتملة. تحقق من SUPABASE_URL وSUPABASE_PUBLISHABLE_KEY.'
  );
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // AsyncStorage persists sessions on iOS/Android. Web uses the browser's
      // default storage implementation supplied by Supabase.
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Keep session refresh active while the native app is foregrounded.
// Supabase auth refresh timers are not managed by AppState automatically in
// React Native, so pause them in the background and resume when active.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
