import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Image from 'next/image'
import { fetchPlateInsights } from '@/app/actions'

export function PlateMetricsModal({ isOpen, onClose, plateNumber }) {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    if (isOpen && plateNumber) {
      const fetchMetrics = async () => {
        try {
          const result = await fetchPlateInsights(plateNumber)
          if (result?.success) {
            setMetrics(result.data)
          }
        } catch (error) {
          console.error('Error fetching metrics:', error)
        }
      }
      fetchMetrics()
    }
  }, [isOpen, plateNumber])

  if (!isOpen) return null
  if (!metrics) return <div>Loading...</div>

  // Convert the metrics object to a string for safe rendering
  const metricsString = JSON.stringify(metrics, null, 2)

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background shadow-lg p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Plate Insights</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div>
        <pre className="whitespace-pre-wrap">
          {metricsString}
        </pre>
      </div>
    </div>
  )
}

PlateMetricsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  plateNumber: PropTypes.string.isRequired,
}