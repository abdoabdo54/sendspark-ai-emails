
import { toast } from '@/hooks/use-toast';

export interface NotificationOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

export const showSuccessNotification = (options: Omit<NotificationOptions, 'variant'>) => {
  toast({
    ...options,
    variant: 'default',
  });
};

export const showErrorNotification = (options: Omit<NotificationOptions, 'variant'>) => {
  toast({
    ...options,
    variant: 'destructive',
  });
};

export const showLoadingNotification = (message: string) => {
  return toast({
    title: "Loading",
    description: message,
    duration: 0, // Don't auto-dismiss
  });
};

export const showValidationErrors = (errors: string[]) => {
  const errorMessage = errors.length === 1 
    ? errors[0] 
    : `Please fix the following issues:\n${errors.map(e => `• ${e}`).join('\n')}`;
  
  showErrorNotification({
    title: "Validation Error",
    description: errorMessage,
    duration: 6000,
  });
};

export const showAccountOperationSuccess = (operation: 'added' | 'updated' | 'deleted', accountName: string) => {
  const actions = {
    added: 'added successfully',
    updated: 'updated successfully', 
    deleted: 'deleted successfully'
  };

  showSuccessNotification({
    title: "Success",
    description: `${accountName} has been ${actions[operation]}`,
  });
};

export const showConnectionTestResult = (success: boolean, details?: string) => {
  if (success) {
    showSuccessNotification({
      title: "Connection Test Successful",
      description: details || "SMTP connection test passed!",
    });
  } else {
    showErrorNotification({
      title: "Connection Test Failed",
      description: details || "Unable to connect to SMTP server. Please check your configuration.",
    });
  }
};
