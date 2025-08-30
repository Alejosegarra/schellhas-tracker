import React from 'react';
import { XIcon } from './Icons';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
};

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
  };

  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};


export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
    return (
        <input 
            {...props} 
            ref={ref}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-100 bg-white text-gray-900 placeholder:text-gray-500 dark:bg-white dark:text-gray-900 dark:placeholder:text-gray-500 ${props.className || ''}`}
        />
    );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => {
    return (
        <select
            {...props}
            ref={ref}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-gray-900 dark:bg-white dark:text-gray-900 ${props.className || ''}`}
        >
            {props.children}
        </select>
    );
});

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input
        type="checkbox"
        ref={ref}
        className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${className || ''}`}
        {...props}
    />
));


type CardProps = {
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<'div'>;

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className || ''}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 border-b border-gray-200 ${className}`}>{children}</div>;
};

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => {
    return <div className={`p-4 ${className}`}>{children}</div>;
};


type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};