import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';

import { HomeScreen } from '@/screens/home/HomeScreen';
import { InventoryScreen } from '@/screens/inventory/InventoryScreen';
import { SalesScreen } from '@/screens/sales/SalesScreen';
import { TicketsScreen } from '@/screens/tickets/TicketsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { AttendanceScreen } from '@/screens/attendance/AttendanceScreen';
import { RecipesScreen } from '@/screens/recipes/RecipesScreen';
import { CloseShopScreen } from '@/screens/closeShop/CloseShopScreen';
import { colors } from '@/lib/colors';

export type MainTabParamList = {
  HomeTab: undefined;
  InventoryTab: undefined;
  SalesTab: undefined;
  TicketsTab: undefined;
  ProfileTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Attendance: undefined;
  Inventory: undefined;
  Sales: undefined;
  Recipes: undefined;
  CloseShop: undefined;
};

export type InventoryStackParamList = {
  Inventory: undefined;
};

export type SalesStackParamList = {
  Sales: undefined;
};

export type TicketsStackParamList = {
  Tickets: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Tickets: undefined;
  Recipes: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();
const SalesStack = createNativeStackNavigator<SalesStackParamList>();
const TicketsStack = createNativeStackNavigator<TicketsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const stackHeaderOptions = { headerShown: false } as const;

function HomeStackNav(): JSX.Element {
  return (
    <HomeStack.Navigator screenOptions={stackHeaderOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Attendance" component={AttendanceScreen} />
      <HomeStack.Screen name="Inventory" component={InventoryScreen} />
      <HomeStack.Screen name="Sales" component={SalesScreen} />
      <HomeStack.Screen name="Recipes" component={RecipesScreen} />
      <HomeStack.Screen name="CloseShop" component={CloseShopScreen} />
    </HomeStack.Navigator>
  );
}

function InventoryStackNav(): JSX.Element {
  return (
    <InventoryStack.Navigator screenOptions={stackHeaderOptions}>
      <InventoryStack.Screen name="Inventory" component={InventoryScreen} />
    </InventoryStack.Navigator>
  );
}

function SalesStackNav(): JSX.Element {
  return (
    <SalesStack.Navigator screenOptions={stackHeaderOptions}>
      <SalesStack.Screen name="Sales" component={SalesScreen} />
    </SalesStack.Navigator>
  );
}

function TicketsStackNav(): JSX.Element {
  return (
    <TicketsStack.Navigator screenOptions={stackHeaderOptions}>
      <TicketsStack.Screen name="Tickets" component={TicketsScreen} />
    </TicketsStack.Navigator>
  );
}

function ProfileStackNav(): JSX.Element {
  return (
    <ProfileStack.Navigator screenOptions={stackHeaderOptions}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="Tickets" component={TicketsScreen} />
      <ProfileStack.Screen name="Recipes" component={RecipesScreen} />
    </ProfileStack.Navigator>
  );
}

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }): JSX.Element {
  return (
    <View
      style={[
        styles.tabIconWrap,
        focused ? styles.tabIconWrapActive : null,
      ]}
    >
      <Text style={[styles.tabIconGlyph, focused ? styles.tabIconGlyphActive : null]}>
        {glyph}
      </Text>
    </View>
  );
}

export function MainTabs(): JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNav}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStackNav}
        options={{
          tabBarLabel: 'Stock',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesStackNav}
        options={{
          tabBarLabel: 'Sales',
          tabBarIcon: ({ focused }) => <TabIcon glyph="💵" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="TicketsTab"
        component={TicketsStackNav}
        options={{
          tabBarLabel: 'Tickets',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🎫" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNav}
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopWidth: 2,
    borderTopColor: colors.borderStrong,
    height: 72,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: { fontSize: 11, fontWeight: '800' },
  tabIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabIconWrapActive: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  tabIconGlyph: { fontSize: 18, fontWeight: '900', color: colors.muted },
  tabIconGlyphActive: { color: colors.accentText },
});