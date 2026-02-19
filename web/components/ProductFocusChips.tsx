'use client'

import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Search, GitBranch, BarChart3, Sparkles, X } from 'lucide-react'
import type { ProductId } from '@/types/agent'
import { PRODUCTS } from '@/lib/lifecycle'

const PRODUCT_ICONS: Record<ProductId, React.ComponentType<{ className?: string }>> = {
  code_search: Search,
  batch_changes: GitBranch,
  code_insights: BarChart3,
  deep_search: Sparkles,
}

const PRODUCT_COLORS: Record<ProductId, { bg: string; text: string; border: string }> = {
  code_search: { 
    bg: 'bg-blue-100 dark:bg-blue-900/30', 
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800'
  },
  batch_changes: { 
    bg: 'bg-purple-100 dark:bg-purple-900/30', 
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800'
  },
  code_insights: { 
    bg: 'bg-green-100 dark:bg-green-900/30', 
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800'
  },
  deep_search: { 
    bg: 'bg-amber-100 dark:bg-amber-900/30', 
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800'
  },
}

interface ProductChipProps {
  productId: ProductId
  selected?: boolean
  onToggle?: (productId: ProductId) => void
  showTooltip?: boolean
  size?: 'sm' | 'md'
}

export function ProductChip({ 
  productId, 
  selected = false, 
  onToggle,
  showTooltip = true,
  size = 'md'
}: ProductChipProps) {
  const product = PRODUCTS.find(p => p.id === productId)
  if (!product) return null
  
  const Icon = PRODUCT_ICONS[productId]
  const colors = PRODUCT_COLORS[productId]
  const isInteractive = !!onToggle
  
  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5 gap-1' 
    : 'text-sm px-2.5 py-1 gap-1.5'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  const chip = (
    <Badge
      variant="outline"
      className={`
        ${sizeClasses}
        ${selected ? `${colors.bg} ${colors.text} ${colors.border}` : 'bg-muted/50 text-muted-foreground border-muted'}
        ${isInteractive ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        inline-flex items-center font-medium
      `}
      onClick={isInteractive ? () => onToggle(productId) : undefined}
    >
      <Icon className={iconSize} />
      <span>{product.label}</span>
    </Badge>
  )

  if (!showTooltip) return chip

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {chip}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{product.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ProductFocusChipsProps {
  selected: ProductId[]
  onChange?: (products: ProductId[]) => void
  showAll?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProductFocusChips({
  selected,
  onChange,
  showAll = true,
  size = 'md',
  className = '',
}: ProductFocusChipsProps) {
  const isInteractive = !!onChange
  
  const handleToggle = (productId: ProductId) => {
    if (!onChange) return
    
    if (selected.includes(productId)) {
      onChange(selected.filter(p => p !== productId))
    } else {
      onChange([...selected, productId])
    }
  }

  const productsToShow = showAll 
    ? PRODUCTS 
    : PRODUCTS.filter(p => selected.includes(p.id))

  if (!showAll && productsToShow.length === 0) {
    return (
      <span className="text-sm text-muted-foreground italic">
        No products selected
      </span>
    )
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {productsToShow.map(product => (
        <ProductChip
          key={product.id}
          productId={product.id}
          selected={selected.includes(product.id)}
          onToggle={isInteractive ? handleToggle : undefined}
          size={size}
        />
      ))}
    </div>
  )
}

interface ProductSelectorProps {
  selected: ProductId[]
  onChange: (products: ProductId[]) => void
  label?: string
  className?: string
}

export function ProductSelector({
  selected,
  onChange,
  label = 'Products of Interest',
  className = '',
}: ProductSelectorProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <ProductFocusChips
        selected={selected}
        onChange={onChange}
        showAll
      />
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Clear all
        </button>
      )}
    </div>
  )
}

// Read-only display of selected products
interface ProductBadgesProps {
  products: ProductId[]
  size?: 'sm' | 'md'
  className?: string
}

export function ProductBadges({ products, size = 'sm', className = '' }: ProductBadgesProps) {
  if (products.length === 0) return null
  
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {products.map(productId => (
        <ProductChip
          key={productId}
          productId={productId}
          selected
          size={size}
          showTooltip={false}
        />
      ))}
    </div>
  )
}
