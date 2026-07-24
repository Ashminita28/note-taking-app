import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast';
import { Button } from './button';
import { useToast } from './use-toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, action }) => (
        <Toast
          key={id}
          variant={variant}
          onOpenChange={(open) => {
            if (!open) dismiss(id);
          }}
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                action.onClick();
                dismiss(id);
              }}
            >
              {action.label}
            </Button>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
