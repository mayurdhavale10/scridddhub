/**
 * Web entry point. Registers the SAME App component used by mobile-app —
 * do not fork this into a separate implementation. See docs/adr/0003.
 */
import { AppRegistry } from 'react-native';
import App from '../mobile-app/App';
import { name as appName } from '../mobile-app/app.json';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
});
