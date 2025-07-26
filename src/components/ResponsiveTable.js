import React, { useState, useEffect } from 'react';

const ResponsiveTable = ({ data, columns, caption, className = '' }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileCardView data={data} columns={columns} className={className} />;
  }
  return <DesktopTableView data={data} columns={columns} caption={caption} className={className} />;
};

const DesktopTableView = ({ data, columns, caption, className }) => (
  <div className={`overflow-x-auto shadow-md rounded-lg ${className}`}>
    <table className="min-w-full bg-white dark:bg-gray-800" role="table">
      {caption && (
        <caption className="caption-bottom p-4 text-sm text-gray-600 dark:text-gray-400">
          {caption}
        </caption>
      )}
      <thead>
        <tr className="bg-gray-100 dark:bg-gray-700">
          {columns.map((column, index) => (
            <th
              key={index}
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${column.className || ''}`}
              onClick={column.sortable ? column.onSort : undefined}
              role="columnheader"
              tabIndex={column.sortable ? 0 : -1}
              onKeyDown={column.sortable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  column.onSort();
                }
              } : undefined}
              aria-sort={column.sortDirection || 'none'}
            >
              {column.header}
              {column.sortable && (
                <span className="ml-1" aria-hidden="true">
                  {column.sortDirection === 'asc' ? '↑' : column.sortDirection === 'desc' ? '↓' : '↕'}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
        {data.map((item, rowIndex) => (
          <tr key={item.id || rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
            {columns.map((column, colIndex) => (
              <td 
                key={colIndex}
                className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${column.cellClassName || ''}`}
                role="cell"
              >
                {column.render ? column.render(item) : item[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileCardView = ({ data, columns, className }) => (
  <div className={`space-y-4 ${className}`} role="list">
    {data.map((item, index) => (
      <div 
        key={item.id || index} 
        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-600"
        role="listitem"
      >
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
              {column.header}:
            </span>
            <span className={`text-gray-900 dark:text-gray-100 text-sm ${column.cellClassName || ''}`}>
              {column.render ? column.render(item) : item[column.key]}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default ResponsiveTable;