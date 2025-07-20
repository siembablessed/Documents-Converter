"use client"

import type React from "react"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, X, GripVertical, FileText, Download } from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import jsPDF from "jspdf"

interface FileItem {
  id: string
  file: File
  preview: string
  name: string
}

interface CoverPageData {
  title: string
  subtitle: string
  author: string
  date: string
  description: string
  backgroundColor: string
  textColor: string
}

export default function DocumentConverter() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [includeCoverPage, setIncludeCoverPage] = useState(false)
  const [sortOrder, setSortOrder] = useState<"name" | "custom">("name")
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [coverPageData, setCoverPageData] = useState<CoverPageData>({
    title: "Document Collection",
    subtitle: "",
    author: "",
    date: new Date().toLocaleDateString(),
    description: "",
    backgroundColor: "#ffffff",
    textColor: "#000000",
  })

  const [enhancementSettings, setEnhancementSettings] = useState({
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    autoEnhance: false,
    denoiseScanned: false,
  })

  const [selectedFileForEdit, setSelectedFileForEdit] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedImageForView, setSelectedImageForView] = useState<FileItem | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  const handleFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter((file) => file.type.startsWith("image/"))

    const fileItems: FileItem[] = imageFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }))

    setFiles((prev) => {
      const combined = [...prev, ...fileItems]
      const sorted = sortOrder === "name" ? combined.sort((a, b) => a.name.localeCompare(b.name)) : combined
      resetPagination()
      return sorted
    })
  }

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      // Revoke object URL to prevent memory leaks
      const fileToRemove = prev.find((item) => item.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return updated
    })
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(files)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setFiles(items)
  }

  const sortFiles = () => {
    if (sortOrder === "name") {
      setFiles((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const itemsPerPage = 4
  const totalPages = Math.ceil(files.length / itemsPerPage)
  const startIndex = currentPage * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFiles = files.slice(startIndex, endIndex)

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  // Reset to first page when files change
  const resetPagination = () => {
    setCurrentPage(0)
  }

  const generateCoverPage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!

      // Use higher resolution for better text quality (3x scale)
      const scale = 3
      canvas.width = 595 * scale
      canvas.height = 842 * scale

      // Scale the context to match
      ctx.scale(scale, scale)

      // Enable high-quality text rendering
      ctx.textBaseline = "top"
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // Background
      ctx.fillStyle = coverPageData.backgroundColor
      ctx.fillRect(0, 0, 595, 842)

      // Text styling with better antialiasing
      ctx.fillStyle = coverPageData.textColor
      ctx.textAlign = "center"

      // Title with better font rendering
      ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif"
      ctx.fillText(coverPageData.title, 595 / 2, 200)

      // Subtitle
      if (coverPageData.subtitle) {
        ctx.font = "24px 'Segoe UI', Arial, sans-serif"
        ctx.fillText(coverPageData.subtitle, 595 / 2, 250)
      }

      // Author
      if (coverPageData.author) {
        ctx.font = "18px 'Segoe UI', Arial, sans-serif"
        ctx.fillText(`By: ${coverPageData.author}`, 595 / 2, 350)
      }

      // Date
      ctx.font = "16px 'Segoe UI', Arial, sans-serif"
      ctx.fillText(coverPageData.date, 595 / 2, 400)

      // Description with better text wrapping
      if (coverPageData.description) {
        ctx.font = "14px 'Segoe UI', Arial, sans-serif"
        const words = coverPageData.description.split(" ")
        let line = ""
        let y = 500

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " "
          const metrics = ctx.measureText(testLine)
          const testWidth = metrics.width

          if (testWidth > 400 && n > 0) {
            ctx.fillText(line, 595 / 2, y)
            line = words[n] + " "
            y += 20
          } else {
            line = testLine
          }
        }
        ctx.fillText(line, 595 / 2, y)
      }

      resolve(canvas.toDataURL("image/jpeg", 1.0))
    })
  }

  const enhanceImage = async (imageData: string, settings: typeof enhancementSettings): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!

        canvas.width = img.width
        canvas.height = img.height

        // Apply enhancements
        ctx.filter = `brightness(${100 + settings.brightness}%) contrast(${100 + settings.contrast}%)`

        if (settings.autoEnhance) {
          ctx.filter += ` saturate(110%) hue-rotate(2deg)`
        }

        ctx.drawImage(img, 0, 0)

        // Apply sharpening if needed
        if (settings.sharpness > 0) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          const factor = settings.sharpness / 10

          // Simple sharpening kernel
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
            const enhancement = brightness * factor

            data[i] = Math.min(255, Math.max(0, data[i] + enhancement))
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + enhancement))
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + enhancement))
          }

          ctx.putImageData(imageData, 0, 0)
        }

        // Denoise for scanned documents
        if (settings.denoiseScanned) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          // Simple noise reduction
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
            if (avg < 50) {
              data[i] = data[i + 1] = data[i + 2] = 0 // Pure black
            } else if (avg > 200) {
              data[i] = data[i + 1] = data[i + 2] = 255 // Pure white
            }
          }

          ctx.putImageData(imageData, 0, 0)
        }

        resolve(canvas.toDataURL("image/jpeg", 0.95))
      }

      img.src = imageData
    })
  }

  const generatePDF = async () => {
    if (files.length === 0) return

    setIsGenerating(true)

    try {
      const pdf = new jsPDF("p", "mm", "a4")
      let isFirstPage = true

      // Add cover page if enabled
      if (includeCoverPage) {
        const coverPageImage = await generateCoverPage()
        pdf.addImage(coverPageImage, "JPEG", 0, 0, 210, 297)
        isFirstPage = false
      }

      // Add images with enhancement
      for (const fileItem of files) {
        if (!isFirstPage) {
          pdf.addPage()
        }

        // Enhance image if settings are applied
        let imageData = fileItem.preview
        if (
          enhancementSettings.brightness !== 0 ||
          enhancementSettings.contrast !== 0 ||
          enhancementSettings.sharpness > 0 ||
          enhancementSettings.autoEnhance ||
          enhancementSettings.denoiseScanned
        ) {
          imageData = await enhanceImage(fileItem.preview, enhancementSettings)
        }

        // Load enhanced image and get dimensions
        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")!

            // Calculate dimensions to fit A4 page
            const pageWidth = 210 // A4 width in mm
            const pageHeight = 297 // A4 height in mm
            const margin = 10

            const maxWidth = pageWidth - margin * 2
            const maxHeight = pageHeight - margin * 2

            const { width, height } = img

            // Scale image to fit page while maintaining aspect ratio
            const widthRatio = maxWidth / (width * 0.264583) // Convert px to mm
            const heightRatio = maxHeight / (height * 0.264583)
            const scale = Math.min(widthRatio, heightRatio)

            const finalWidth = width * 0.264583 * scale
            const finalHeight = height * 0.264583 * scale

            // Center the image
            const x = (pageWidth - finalWidth) / 2
            const y = (pageHeight - finalHeight) / 2

            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0)

            const finalImageData = canvas.toDataURL("image/jpeg", 0.95)
            pdf.addImage(finalImageData, "JPEG", x, y, finalWidth, finalHeight)

            resolve(null)
          }

          img.onerror = reject
          img.src = imageData
        })

        isFirstPage = false
      }

      // Save PDF
      pdf.save("converted-documents.pdf")
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Converter</h1>
        <p className="text-muted-foreground">Convert images to PDF with custom ordering and cover pages</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </CardTitle>
              <CardDescription>Drag and drop images or click to select files</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Drop images here or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports JPG, PNG, GIF, WebP formats</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Uploaded Files ({files.length})</h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sort-order" className="text-sm">
                        Order:
                      </Label>
                      <Select
                        value={sortOrder}
                        onValueChange={(value: "name" | "custom") => {
                          setSortOrder(value)
                          if (value === "name") {
                            sortFiles()
                          }
                          resetPagination()
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">By Name</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="files" isDropDisabled={sortOrder === "name"}>
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {currentFiles.map((fileItem, index) => {
                            const actualIndex = startIndex + index
                            return (
                              <Draggable
                                key={fileItem.id}
                                draggableId={fileItem.id}
                                index={actualIndex}
                                isDragDisabled={sortOrder === "name"}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center gap-3 p-3 border rounded-lg bg-background ${
                                      snapshot.isDragging ? "shadow-lg" : ""
                                    }`}
                                  >
                                    {sortOrder === "custom" && (
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <img
                                      src={fileItem.preview || "/placeholder.svg"}
                                      alt={fileItem.name}
                                      className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setSelectedImageForView(fileItem)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{fileItem.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => removeFile(fileItem.id)}>
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 0}>
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Image Viewer Modal */}
              {selectedImageForView && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                  onClick={() => setSelectedImageForView(null)}
                >
                  <div className="relative max-w-4xl max-h-[90vh] p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
                      onClick={() => setSelectedImageForView(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <img
                      src={selectedImageForView.preview || "/placeholder.svg"}
                      alt={selectedImageForView.name}
                      className="max-w-full max-h-full object-contain rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-3 py-1 rounded text-sm">
                      {selectedImageForView.name}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="cover-page" checked={includeCoverPage} onCheckedChange={setIncludeCoverPage} />
                <Label htmlFor="cover-page">Include cover page</Label>
              </div>

              <Button onClick={generatePDF} disabled={files.length === 0 || isGenerating} className="w-full">
                {isGenerating ? (
                  "Generating PDF..."
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Image Enhancement</CardTitle>
                <CardDescription>Improve scanned documents and image quality</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-enhance"
                    checked={enhancementSettings.autoEnhance}
                    onCheckedChange={(checked) =>
                      setEnhancementSettings((prev) => ({ ...prev, autoEnhance: checked as boolean }))
                    }
                  />
                  <Label htmlFor="auto-enhance">Auto enhance</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="denoise-scanned"
                    checked={enhancementSettings.denoiseScanned}
                    onCheckedChange={(checked) =>
                      setEnhancementSettings((prev) => ({ ...prev, denoiseScanned: checked as boolean }))
                    }
                  />
                  <Label htmlFor="denoise-scanned">Denoise scanned docs</Label>
                </div>

                <div>
                  <Label htmlFor="brightness">Brightness: {enhancementSettings.brightness}%</Label>
                  <input
                    id="brightness"
                    type="range"
                    min="-50"
                    max="50"
                    value={enhancementSettings.brightness}
                    onChange={(e) =>
                      setEnhancementSettings((prev) => ({ ...prev, brightness: Number.parseInt(e.target.value) }))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <Label htmlFor="contrast">Contrast: {enhancementSettings.contrast}%</Label>
                  <input
                    id="contrast"
                    type="range"
                    min="-50"
                    max="50"
                    value={enhancementSettings.contrast}
                    onChange={(e) =>
                      setEnhancementSettings((prev) => ({ ...prev, contrast: Number.parseInt(e.target.value) }))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <Label htmlFor="sharpness">Sharpness: {enhancementSettings.sharpness}</Label>
                  <input
                    id="sharpness"
                    type="range"
                    min="0"
                    max="10"
                    value={enhancementSettings.sharpness}
                    onChange={(e) =>
                      setEnhancementSettings((prev) => ({ ...prev, sharpness: Number.parseInt(e.target.value) }))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEnhancementSettings({
                      brightness: 0,
                      contrast: 0,
                      sharpness: 0,
                      autoEnhance: false,
                      denoiseScanned: false,
                    })
                  }
                  className="w-full"
                >
                  Reset Enhancements
                </Button>
              </CardContent>
            </Card>
          )}

          {includeCoverPage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Cover Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={coverPageData.title}
                        onChange={(e) => setCoverPageData((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Document title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="subtitle">Subtitle</Label>
                      <Input
                        id="subtitle"
                        value={coverPageData.subtitle}
                        onChange={(e) => setCoverPageData((prev) => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="Optional subtitle"
                      />
                    </div>

                    <div>
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        value={coverPageData.author}
                        onChange={(e) => setCoverPageData((prev) => ({ ...prev, author: e.target.value }))}
                        placeholder="Author name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        value={coverPageData.date}
                        onChange={(e) => setCoverPageData((prev) => ({ ...prev, date: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={coverPageData.description}
                        onChange={(e) => setCoverPageData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="style" className="space-y-4">
                    <div>
                      <Label htmlFor="bg-color">Background Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bg-color"
                          type="color"
                          value={coverPageData.backgroundColor}
                          onChange={(e) => setCoverPageData((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="w-16 h-10"
                        />
                        <Input
                          value={coverPageData.backgroundColor}
                          onChange={(e) => setCoverPageData((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="text-color">Text Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="text-color"
                          type="color"
                          value={coverPageData.textColor}
                          onChange={(e) => setCoverPageData((prev) => ({ ...prev, textColor: e.target.value }))}
                          className="w-16 h-10"
                        />
                        <Input
                          value={coverPageData.textColor}
                          onChange={(e) => setCoverPageData((prev) => ({ ...prev, textColor: e.target.value }))}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
