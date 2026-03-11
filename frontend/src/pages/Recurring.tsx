import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, PlusCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Recurring() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [recurring, setRecurring] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [categoryId, setCategoryId] = useState('')
  const [expenseType, setExpenseType] = useState('fixed')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    loadData()
  }, [isAuthenticated, navigate])

  const loadData = async () => {
    try {
      const [recRes, catRes] = await Promise.all([
        apiFetch('/recurring'),
        apiFetch('/categories')
      ])
      setRecurring(recRes.recurring_transactions || [])
      setCategories(catRes.categories || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiFetch('/recurring', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          type,
          category_id: categoryId || null,
          expense_type: type === 'expense' ? expenseType : null,
          description,
          frequency,
          start_date: startDate
        })
      })
      // Reset
      setAmount('')
      setDescription('')
      loadData()
    } catch (e: any) {
      alert(e.message || 'Error creating recurring transaction')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/recurring/${id}`, { method: 'DELETE' })
      loadData()
    } catch (e: any) {
      alert(e.message || 'Error deleting recurring transaction')
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6 mt-8">
      <div className="flex items-center space-x-4 mb-8">
        <Link to="/dashboard" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Auto Charges (Recurring)</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">New Auto Charge</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              {type === 'expense' && (
                <div className="space-y-2">
                  <Label>Expense Type</Label>
                  <select className="w-full flex h-10 rounded-md border border-input bg-background px-3" value={expenseType} onChange={(e) => setExpenseType(e.target.value)}>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">None</option>
                  {categories.filter(c => c.type === type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Frequency</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <Button type="submit" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="md:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desc</TableHead>
                <TableHead>Freq</TableHead>
                <TableHead>Next</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No recurring transactions.
                  </TableCell>
                </TableRow>
              ) : (
                recurring.map((rt: any) => (
                  <TableRow key={rt.id}>
                    <TableCell>
                      <div className="font-medium">{rt.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {rt.category_name || 'No Category'} {rt.expense_type ? `· ${rt.expense_type}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{rt.frequency}</TableCell>
                    <TableCell>{rt.next_date}</TableCell>
                    <TableCell className={`text-right font-medium ${rt.type === 'income' ? 'text-green-600' : ''}`}>
                      {rt.type === 'income' ? '+' : '-'}${rt.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rt.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
