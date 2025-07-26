import React from 'react';

const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Caricamento...', 
  showText = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div 
        className={`animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400 ${sizeClasses[size]}`}
        role="status"
        aria-label={text}
      />
      {showText && (
        <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;