import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { GlassView } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/utils/constants';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TABS = [
  { name: 'index',     title: 'Home',      icon: 'home'              as IoniconName },
  { name: 'tasks',     title: 'Tasks',     icon: 'checkmark-circle'  as IoniconName },
  { name: 'habits',    title: 'Habits',    icon: 'repeat'            as IoniconName },
  { name: 'notes',     title: 'Notes',     icon: 'document-text'     as IoniconName },
  { name: 'assistant', title: 'Assistant', icon: 'mic'               as IoniconName },
];

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 8) + 14 }]} pointerEvents="box-none">
      <GlassView style={styles.pill} glassEffectStyle="regular">
        {state.routes.map((route, index) => {
          const tab = TABS.find(t => t.name === route.name);
          if (!tab) return null; // skip hidden tabs (e.g. history)
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Ionicons
                  name={isFocused ? tab.icon : (`${tab.icon}-outline` as IoniconName)}
                  size={20}
                  color={isFocused ? COLORS.primary : COLORS.textMuted}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </GlassView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title }}
        />
      ))}
      {/* Screens accessible via navigation but not shown in tab bar */}
      <Tabs.Screen name="history"       options={{ href: null }} />
      <Tabs.Screen name="weeklyreview"  options={{ href: null }} />
      <Tabs.Screen name="projects"      options={{ href: null }} />
      <Tabs.Screen name="calendar"      options={{ href: null }} />
      <Tabs.Screen name="dayplanner"    options={{ href: null }} />
      <Tabs.Screen name="dependencygraph" options={{ href: null }} />
      <Tabs.Screen name="templates"       options={{ href: null }} />
      <Tabs.Screen name="focusstats"      options={{ href: null }} />
      <Tabs.Screen name="moodlog"         options={{ href: null }} />
      <Tabs.Screen name="communication" options={{ href: null }} />
      <Tabs.Screen name="settings"  options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  pill: {
    flexDirection: 'row',
    // Fallback background on Android / iOS < 26
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 40,
    height: 68,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(232,234,240,0.7)',
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 68,
  },
  iconWrap: {
    width: 40,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
  },
});
