import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Dashboard() {
  const { logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<any>({ transactions: [], balance: 0 })
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [expenseType, setExpenseType] = useState('fixed')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    loadData()
  }, [isAuthenticated, navigate])

  const loadData = async () => {
    try {
      const [txRes, catRes] = await Promise.all([
        apiFetch('/transactions'),
        apiFetch('/categories')
      ])
      setData(txRes)
      setCategories(catRes.categories || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({ 
          amount: Number(amount), 
          type, 
          description,
          category_id: categoryId || null,
          expense_type: type === 'expense' ? expenseType : null
        })
      })
      
      // Reset form and reload list
      setAmount('')
      setDescription('')
      setType('expense')
      setCategoryId('')
      setExpenseType('fixed')
      setIsDialogOpen(false)
      loadData()
    } catch (e: any) {
      alert(e.message || 'Error adding transaction')
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6 mt-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate('/categories')}>Categories</Button>
          <Button variant="outline" onClick={() => navigate('/recurring')}>Auto Charges</Button>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            ${data.balance.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-8">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
              <DialogDescription>Add a new income or expense to your tracker.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTransaction} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type</Label>
                <select 
                  id="type"
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              {type === 'expense' && (
                <div className="space-y-2">
                  <Label>Expense Type</Label>
                  <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm border-input" value={expenseType} onChange={(e) => setExpenseType(e.target.value)}>
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Category</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm border-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">None</option>
                  {categories.filter(c => c.type === type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    step="0.01" 
                    min="0"
                    required 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    required 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Save Transaction</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : (
              data.transactions.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600' : ''}`}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
