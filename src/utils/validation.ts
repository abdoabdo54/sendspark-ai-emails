
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateSMTPConfig = (config: any): ValidationResult => {
  const errors: string[] = [];

  if (!config.host?.trim()) {
    errors.push('SMTP host is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Valid SMTP port (1-65535) is required');
  }

  if (!config.username?.trim()) {
    errors.push('SMTP username is required');
  }

  if (!config.password?.trim()) {
    errors.push('SMTP password is required');
  }

  if (!['none', 'tls', 'ssl'].includes(config.encryption)) {
    errors.push('Valid encryption method is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateAppsScriptConfig = (config: any): ValidationResult => {
  const errors: string[] = [];

  if (!config.script_id?.trim()) {
    errors.push('Google Apps Script ID is required');
  }

  if (!config.deployment_id?.trim()) {
    errors.push('Deployment ID is required');
  }

  if (!config.daily_quota || config.daily_quota < 1) {
    errors.push('Valid daily quota is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePowerMTAConfig = (config: any): ValidationResult => {
  const errors: string[] = [];

  if (!config.server_host?.trim()) {
    errors.push('PowerMTA server host is required');
  }

  if (!config.api_port || config.api_port < 1 || config.api_port > 65535) {
    errors.push('Valid API port is required');
  }

  if (!config.username?.trim()) {
    errors.push('Username is required');
  }

  if (!config.password?.trim()) {
    errors.push('Password is required');
  }

  if (!config.virtual_mta?.trim()) {
    errors.push('Virtual MTA is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateAccountData = (accountData: any): ValidationResult => {
  const errors: string[] = [];

  if (!accountData.name?.trim()) {
    errors.push('Account name is required');
  }

  if (!accountData.email?.trim()) {
    errors.push('Email address is required');
  } else if (!validateEmail(accountData.email)) {
    errors.push('Valid email address is required');
  }

  if (!['smtp', 'apps-script', 'powermta'].includes(accountData.type)) {
    errors.push('Valid account type is required');
  }

  // Validate config based on type
  let configValidation: ValidationResult;
  switch (accountData.type) {
    case 'smtp':
      configValidation = validateSMTPConfig(accountData.config);
      break;
    case 'apps-script':
      configValidation = validateAppsScriptConfig(accountData.config);
      break;
    case 'powermta':
      configValidation = validatePowerMTAConfig(accountData.config);
      break;
    default:
      configValidation = { isValid: false, errors: ['Invalid account type'] };
  }

  errors.push(...configValidation.errors);

  return {
    isValid: errors.length === 0,
    errors
  };
};
