import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '@/screens/home/HomeScreen';
import { InventoryScreen } from '@/screens/inventory/InventoryScreen';
import { SalesScreen } from '@/screens/sales/SalesScreen';
import { AttendanceScreen } from '@/screens/attendance/AttendanceScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

export type MainTabParamList = {
  Home: undefined;
  Inventory: undefined;
  Sales: undefined;
  Attendance: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen name="Sales" component={SalesScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
