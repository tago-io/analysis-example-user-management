/*
 ** Analysis Example
 ** User management
 **
 ** Get the dashboard for this analysis here: http://admin.tago.io/template/5f5931ddd70605002e41a649
 **
 ** This analysis shows how to create, update, and delete a user for your application.
 **
 ** Environment Variables
 ** In order to use this analysis, you must setup the Environment Variable table.
 **
 ** account_token: Your account token
 **
 ** Steps to generate an account_token:
 ** 1 - Enter the following link: https://admin.tago.io/account/
 ** 2 - Select your Profile.
 ** 3 - Enter Tokens tab.
 ** 4 - Generate a new Token with Expires Never.
 ** 5 - Press the Copy Button and place at the Environment Variables tab of this analysis.
 */

const { Analysis, Account, Utils, Device } = require("@tago-io/sdk");

async function createUser({ account, environment_variables, device, device_id, scope }) {
  const account_info = await account.info()

  // Find the values received from the scope that are sent using the input form widget.
  const user_name = scope.find(data => data.variable === 'user_name').value;
  if (!user_name) console.log('You must provide a name.')
  const user_email = scope.find(data => data.variable === 'user_email').value;
  if (!user_email) console.log('You must provide an email.')
  const user_password = String(scope.find(data => data.variable === 'user_password').value);
  if (!user_password) console.log('You must provide a password.')
  
  // The user info is inserted below
  const user_info = {
    email: user_email,
    password: user_password,
    name: user_name,
    timezone: account_info.timezone,
    active: true, // Optional
    // company: 'TagoIO', // Optional
    // language: account_info.language, // Optional
    // phone: '12345678', // Optional
    // tags: [{ key: 'your-tag-name', value: 'your-tag-value' }] // Optional
  };

  const [user_exists] = await account.run.listUsers({ filter: { email: user_email } });

  if (user_exists) return console.log('User already exists.')

  try {
    // Create the new user
    await account.run.userCreate(user_info);
    console.log(`User ${user_name} successfully created.`);
  } catch (error) {
    console.log(error);
  }

  const [user] = await account.run.listUsers({ filter: { email: user_email } });

  // Insert the user id in the metadata, to make easier to delete the user.
  const user_data = scope.map(item => {
    item.metadata = {};
    item.metadata.user_id = user.id;
    return item;
  });

  try {
    // Insert the user data in the bucket
    await device.sendData(user_data);
  } catch (error) {
    console.log(error);
  }
}

async function editUser({ account, device, scope }) {
  const user_id = scope[0].metadata.user_id;

  const new_user_info = {};

  // Search for the user with matching id
  const [user_to_edit] = await account.run.listUsers({ filter: { id: user_id } });

  if (!user_to_edit) {
    return console.log('No user found.')
  }

  // Find the edited values received from the scope that are sent from the table.
  const user_name = scope.find(data => data.variable === 'user_name');
  if (user_name) new_user_info.name = user_name.value;
  const user_email = scope.find(data => data.variable === 'user_email');
  if (user_email) new_user_info.email = user_email.value;
  const user_password = scope.find(data => data.variable === 'user_password');
  if (user_password) new_user_info.password = String(user_password.value);

  try {
    // This action will overwrite the old value.
    // Edits the user info
    await account.run.userEdit(user_id, new_user_info);
    console.log(`User ${user_to_edit.name} successfully edited.`);
  } catch (error) {
    console.log(error);
  }
}

async function deleteUser({ account, device, scope }) {
  const user_id = scope[0].metadata.user_id;

  // Search for the user with matching id
  const [user_to_delete] = await account.run.listUsers({ filter: { id: user_id } });

  if (!user_to_delete) {
    return console.log('No user found.')
  }

  try {
    // Deletes the user
    await account.run.userDelete(user_id);
    console.log(`User ${user_to_delete.name} successfully deleted.`);
  } catch (error) {
    console.log(error);
  }
}

async function init(context, scope) {
  if (!scope[0]) return context.log('This analysis must be triggered by a widget.');

  // Get the environment variables.
  const environment_variables = Utils.envToJson(context.environment);
  if (!environment_variables.account_token) return context.log('Missing "account_token" environment variable');
  else if (environment_variables.account_token.length !== 36) return context.log('Invalid "account_token" in the environment variable');

  // Instance the Account class
  const account = new Account({ token: environment_variables.account_token });

  // Instance the device class using the origin from scope variables.
  // Origin is always the device used in the widget to trigger the analysis.
  const device_id = scope[0].origin;
  const device_token = await Utils.getTokenByName(account, device_id);
  const device = new Device({ token: device_token });

  try {
    // Check the environment_variables._widget_exec.
    // This is a private parameter always sent when a user trigger an analysis using a Dynamic Table or an Input Form.
    // In this case, we check for edit and delete, that is sent by a Dynamic Table, and insert is sent by an input form.
    if (environment_variables._widget_exec === 'edit') {
      await editUser({ account, device, scope });
    } else if (environment_variables._widget_exec === 'delete') {
      await deleteUser({ account, device, scope });
    } else if (environment_variables._widget_exec === 'insert') {
      await createUser({ account, environment_variables, device, device_id, scope });
    }
  } catch (e) {
    // Output the error to the Analysis console.
    context.log(e);
    // Store a data to the field validation of the Input widget.
    // The validation field is useful to send feedback messages.
    device.sendData({ variable: 'action_validation', value: e, metadata: { color: 'darkred' } });
  }

  context.log('Script end.');
}

module.exports = new Analysis(init);

// To run analysis on your machine (external)
// module.exports = new Analysis(init, { token: "3293db09-5e26-4313-b95a-5cef9a4cc8c8" });
