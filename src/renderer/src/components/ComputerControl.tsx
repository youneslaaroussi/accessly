import React, { useState, useEffect } from 'react'

interface Tool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

interface FunctionResult {
  success: boolean
  data?: any
  error?: string
}

export const ComputerControl: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<string>('')
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [result, setResult] = useState<FunctionResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      const availableTools = await window.api.computer.getTools()
      setTools(availableTools)
    } catch (error) {
      console.error('Failed to load tools:', error)
    }
  }

  const executeFunction = async () => {
    if (!selectedTool) return

    setLoading(true)
    setResult(null)

    try {
      const result = await window.api.computer.executeFunction(selectedTool, parameters)
      setResult(result)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value
    }))
  }

  const selectedToolDef = tools.find(tool => tool.name === selectedTool)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">Computer Control</h3>
      
      <div>
        <label className="block text-xs font-medium mb-1 text-gray-400">Select Tool:</label>
        <select 
          value={selectedTool} 
          onChange={(e) => {
            setSelectedTool(e.target.value)
            setParameters({})
            setResult(null)
          }}
          className="w-full p-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
        >
          <option value="">Select a tool...</option>
          {tools.map(tool => (
            <option key={tool.name} value={tool.name}>
              {tool.name} - {tool.description}
            </option>
          ))}
        </select>
      </div>

      {selectedToolDef && Object.keys(selectedToolDef.parameters.properties).length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2 text-gray-400">Parameters:</h4>
          {Object.entries(selectedToolDef.parameters.properties).map(([paramName, paramDef]: [string, any]) => (
            <div key={paramName} className="mb-2">
              <label className="block text-xs font-medium mb-1 text-gray-300">
                {paramName}
                {selectedToolDef.parameters.required.includes(paramName) && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </label>
              <p className="text-xs text-gray-500 mb-1">{paramDef.description}</p>
              
              {paramDef.enum ? (
                <select
                  value={parameters[paramName] || ''}
                  onChange={(e) => handleParameterChange(paramName, e.target.value)}
                  className="w-full p-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                >
                  <option value="">Select...</option>
                  {paramDef.enum.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : paramDef.type === 'number' ? (
                <input
                  type="number"
                  value={parameters[paramName] || ''}
                  onChange={(e) => handleParameterChange(paramName, Number(e.target.value))}
                  className="w-full p-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                />
              ) : (
                <input
                  type="text"
                  value={parameters[paramName] || ''}
                  onChange={(e) => handleParameterChange(paramName, e.target.value)}
                  className="w-full p-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-white"
                  placeholder={paramDef.description}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={executeFunction}
        disabled={!selectedTool || loading}
        className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600"
      >
        {loading ? 'Executing...' : 'Execute Function'}
      </button>

      {result && (
        <div className={`p-2 rounded text-xs ${result.success ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600'} border`}>
          <h4 className="font-medium mb-1 text-gray-300">
            {result.success ? 'Success' : 'Error'}
          </h4>
          {result.error && (
            <p className="text-red-400 mb-1">{result.error}</p>
          )}
          {result.data && (
            <div>
              <p className="text-gray-400 mb-1">Result:</p>
              <pre className="text-xs bg-gray-800 p-1.5 rounded overflow-auto max-h-32 text-gray-300">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="p-2 bg-gray-800/50 border border-gray-700 rounded">
        <h4 className="text-xs font-medium text-gray-400 mb-2">Quick Actions:</h4>
        <div className="grid grid-cols-1 gap-1">
          <button
            onClick={() => window.api.computer.executeFunction('take_screenshot', {})}
            className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
          >
            Take Screenshot
          </button>
          <button
            onClick={() => window.api.computer.executeFunction('get_screen_size', {})}
            className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
          >
            Get Screen Size
          </button>
          <button
            onClick={() => window.api.computer.executeFunction('read_screen_text', {})}
            className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
          >
            Read Screen Text
          </button>
        </div>
      </div>
    </div>
  )
}