import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full border-collapse text-left text-body ${className}`} {...props} />
  )
}

function TableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`border-b border-gray-200 ${className}`} {...props} />
}

function TableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-gray-100 ${className}`} {...props} />
}

function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-gray-50 ${className}`} {...props} />
}

function TableHeaderCell({
  className = '',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-caption font-semibold uppercase tracking-wide text-gray-500 ${className}`}
      {...props}
    />
  )
}

function TableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`} {...props} />
}

export { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell }
