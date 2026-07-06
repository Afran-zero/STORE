import 'react-native-gesture-handler';
import { Platform } from 'react-native';

import { AppRoot } from './src/AppRoot';

if (__DEV__ && Platform.OS === 'web') {
  import('react-grab');
}

export default AppRoot;