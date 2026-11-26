// Hooks the full front-end (title, menus, briefing, tally, ending...) into the scene flow.
import { startupHooks } from '../../hooks';
import { installUiFlow } from '../../scenes/install';

startupHooks.push(installUiFlow);
