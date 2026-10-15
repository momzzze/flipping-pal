import { useState } from 'react'
import { Dashboard } from '@/components/Dashboard'
import { DataModeBanner } from '@/components/DataModeBanner'
import { ErrorState } from '@/components/ErrorState'
import { RecipeEditor } from '@/components/RecipeEditor'
import { SettingsView } from '@/components/SettingsView'
import { TopNav, type View } from '@/components/TopNav'
import { useStatus } from '@/hooks/queries'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null)
  const status = useStatus()

  const editRecipe = (recipeId: number) => {
    setEditingRecipeId(recipeId)
    setView('recipes')
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopNav view={view} onViewChange={setView} status={status.data} />
      <DataModeBanner status={status.data} />
      {status.isError && (
        <div className="p-4">
          <ErrorState
            title="Cannot reach the Azeroth Flip API"
            error={status.error}
            onRetry={() => void status.refetch()}
          />
        </div>
      )}
      {view === 'dashboard' && <Dashboard key="dashboard" onEditRecipe={editRecipe} />}
      {view === 'watchlist' && <Dashboard key="watchlist" watchlistMode onEditRecipe={editRecipe} />}
      {view === 'recipes' && <RecipeEditor selectedId={editingRecipeId} onSelect={setEditingRecipeId} />}
      {view === 'settings' && <SettingsView status={status.data} />}
    </div>
  )
}
