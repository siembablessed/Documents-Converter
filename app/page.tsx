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
import { Upload, X, GripVertical, FileText, File, ImageIcon, Archive, Code, Globe } from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import jsPDF from "jspdf"

interface FileItem {
  id: string
  file: File
  preview: string
  name: string
  type: "image" | "document" | "pdf"
  content?: string
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

interface ConversionOptions {
  outputFormat: "pdf" | "docx" | "txt" | "html" | "md" | "rtf" | "csv" | "json" | "zip" | "png" | "jpg"
  imageQuality: number
  pageSize: "a4" | "letter" | "a3"
  orientation: "portrait" | "landscape"
  mergeDocuments: boolean
  includeMetadata: boolean
  compressionLevel: number
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

  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    outputFormat: "pdf",
    imageQuality: 85,
    pageSize: "a4",
    orientation: "portrait",
    mergeDocuments: true,
    includeMetadata: true,
    compressionLevel: 6,
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

  const getFileType = (file: File): "image" | "document" | "pdf" => {
    if (file.type.startsWith("image/")) return "image"
    if (file.type === "application/pdf") return "pdf"
    return "document"
  }

  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve((e.target?.result as string) || "")
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const handleFiles = async (newFiles: File[]) => {
    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "text/html",
      "text/markdown",
      "application/rtf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    const validFiles = newFiles.filter(
      (file) =>
        supportedTypes.some((type) => file.type === type) ||
        file.name.toLowerCase().endsWith(".txt") ||
        file.name.toLowerCase().endsWith(".md") ||
        file.name.toLowerCase().endsWith(".rtf"),
    )

    const fileItems: FileItem[] = []

    for (const file of validFiles) {
      const fileType = getFileType(file)
      let preview = ""
      let content = ""

      if (fileType === "image") {
        preview = URL.createObjectURL(file)
      } else if (fileType === "document") {
        try {
          if (
            file.type.startsWith("text/") ||
            file.name.toLowerCase().endsWith(".txt") ||
            file.name.toLowerCase().endsWith(".md")
          ) {
            content = await readTextFile(file)
            preview = content.substring(0, 200) + (content.length > 200 ? "..." : "")
          } else {
            preview = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
          }
        } catch (error) {
          console.error("Error reading file:", error)
          preview = `${file.name} (Unable to preview)`
        }
      } else if (fileType === "pdf") {
        preview = `PDF Document (${(file.size / 1024 / 1024).toFixed(2)} MB)`
      }

      fileItems.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        name: file.name,
        type: fileType,
        content,
      })
    }

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
      const fileToRemove = prev.find((item) => item.id === id)
      if (fileToRemove && fileToRemove.type === "image") {
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

  const resetPagination = () => {
    setCurrentPage(0)
  }

  const generateCoverPage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!

      const scale = 3
      canvas.width = 595 * scale
      canvas.height = 842 * scale
      ctx.scale(scale, scale)

      ctx.textBaseline = "top"
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      ctx.fillStyle = coverPageData.backgroundColor
      ctx.fillRect(0, 0, 595, 842)

      ctx.fillStyle = coverPageData.textColor
      ctx.textAlign = "center"

      ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif"
      ctx.fillText(coverPageData.title, 595 / 2, 200)

      if (coverPageData.subtitle) {
        ctx.font = "24px 'Segoe UI', Arial, sans-serif"
        ctx.fillText(coverPageData.subtitle, 595 / 2, 250)
      }

      if (coverPageData.author) {
        ctx.font = "18px 'Segoe UI', Arial, sans-serif"
        ctx.fillText(`By: ${coverPageData.author}`, 595 / 2, 350)
      }

      ctx.font = "16px 'Segoe UI', Arial, sans-serif"
      ctx.fillText(coverPageData.date, 595 / 2, 400)

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

        ctx.filter = `brightness(${100 + settings.brightness}%) contrast(${100 + settings.contrast}%)`

        if (settings.autoEnhance) {
          ctx.filter += ` saturate(110%) hue-rotate(2deg)`
        }

        ctx.drawImage(img, 0, 0)

        if (settings.sharpness > 0) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          const factor = settings.sharpness / 10

          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
            const enhancement = brightness * factor

            data[i] = Math.min(255, Math.max(0, data[i] + enhancement))
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + enhancement))
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + enhancement))
          }

          ctx.putImageData(imageData, 0, 0)
        }

        if (settings.denoiseScanned) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
            if (avg < 50) {
              data[i] = data[i + 1] = data[i + 2] = 0
            } else if (avg > 200) {
              data[i] = data[i + 1] = data[i + 2] = 255
            }
          }

          ctx.putImageData(imageData, 0, 0)
        }

        resolve(canvas.toDataURL("image/jpeg", conversionOptions.imageQuality / 100))
      }

      img.src = imageData
    })
  }

  const addTextToPDF = (pdf: jsPDF, text: string, startY = 20): number => {
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    const lineHeight = 7

    pdf.setFontSize(12)
    const lines = pdf.splitTextToSize(text, maxWidth)

    let currentY = startY

    for (const line of lines) {
      if (currentY > pageHeight - margin) {
        pdf.addPage()
        currentY = margin
      }
      pdf.text(line, margin, currentY)
      currentY += lineHeight
    }

    return currentY
  }

  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateMetadata = () => {
    return {
      title: coverPageData.title || "Document Collection",
      author: coverPageData.author || "Unknown",
      createdDate: new Date().toISOString(),
      totalFiles: files.length,
      fileTypes: {
        images: files.filter((f) => f.type === "image").length,
        documents: files.filter((f) => f.type === "document").length,
        pdfs: files.filter((f) => f.type === "pdf").length,
      },
      conversionSettings: conversionOptions,
    }
  }

  const generateDocument = async () => {
    if (files.length === 0) return

    setIsGenerating(true)

    try {
      const metadata = conversionOptions.includeMetadata ? generateMetadata() : null

      switch (conversionOptions.outputFormat) {
        case "pdf":
          await generatePDF()
          break
        case "txt":
          await generateTXT()
          break
        case "html":
          await generateHTML()
          break
        case "md":
          await generateMarkdown()
          break
        case "csv":
          await generateCSV()
          break
        case "json":
          await generateJSON()
          break
        case "rtf":
          await generateRTF()
          break
        case "zip":
          await generateZIP()
          break
        case "png":
        case "jpg":
          await generateImages()
          break
        default:
          console.error("Unsupported output format")
      }
    } catch (error) {
      console.error("Error generating document:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const generatePDF = async () => {
    const pdf = new jsPDF(conversionOptions.orientation, "mm", conversionOptions.pageSize)
    let isFirstPage = true

    if (includeCoverPage) {
      const coverPageImage = await generateCoverPage()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(coverPageImage, "JPEG", 0, 0, pageWidth, pageHeight)
      isFirstPage = false
    }

    for (const fileItem of files) {
      if (!isFirstPage) {
        pdf.addPage()
      }

      if (fileItem.type === "image") {
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

        const img = new Image()
        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = () => {
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const margin = 10

            const maxWidth = pageWidth - margin * 2
            const maxHeight = pageHeight - margin * 2

            const { width, height } = img

            const widthRatio = maxWidth / (width * 0.264583)
            const heightRatio = maxHeight / (height * 0.264583)
            const scale = Math.min(widthRatio, heightRatio)

            const finalWidth = width * 0.264583 * scale
            const finalHeight = height * 0.264583 * scale

            const x = (pageWidth - finalWidth) / 2
            const y = (pageHeight - finalHeight) / 2

            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")!
            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0)

            const finalImageData = canvas.toDataURL("image/jpeg", conversionOptions.imageQuality / 100)
            pdf.addImage(finalImageData, "JPEG", x, y, finalWidth, finalHeight)

            resolve(null)
          }

          img.onerror = reject
          img.src = imageData
        })
      } else if (fileItem.type === "document" && fileItem.content) {
        pdf.setFontSize(14)
        pdf.text(`Document: ${fileItem.name}`, 20, 20)
        pdf.setFontSize(12)
        addTextToPDF(pdf, fileItem.content, 35)
      } else if (fileItem.type === "pdf") {
        pdf.setFontSize(14)
        pdf.text(`PDF Document: ${fileItem.name}`, 20, 20)
        pdf.setFontSize(12)
        pdf.text(`Size: ${(fileItem.file.size / 1024 / 1024).toFixed(2)} MB`, 20, 35)
        pdf.text("Note: PDF merging requires server-side processing", 20, 50)
      }

      isFirstPage = false
    }

    pdf.save("converted-documents.pdf")
  }

  const generateTXT = async () => {
    let textContent = ""

    if (includeCoverPage) {
      textContent += `${coverPageData.title}\n`
      if (coverPageData.subtitle) textContent += `${coverPageData.subtitle}\n`
      if (coverPageData.author) textContent += `By: ${coverPageData.author}\n`
      textContent += `${coverPageData.date}\n`
      if (coverPageData.description) textContent += `\n${coverPageData.description}\n`
      textContent += "\n" + "=".repeat(50) + "\n\n"
    }

    for (const fileItem of files) {
      textContent += `Document: ${fileItem.name}\n`
      textContent += "-".repeat(30) + "\n"

      if (fileItem.type === "document" && fileItem.content) {
        textContent += fileItem.content + "\n\n"
      } else if (fileItem.type === "image") {
        textContent += `[Image file: ${fileItem.name}]\n\n`
      } else if (fileItem.type === "pdf") {
        textContent += `[PDF file: ${fileItem.name}]\n\n`
      }
    }

    downloadFile(textContent, "converted-documents.txt", "text/plain")
  }

  const generateHTML = async () => {
    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${coverPageData.title || "Document Collection"}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .cover { text-align: center; margin-bottom: 40px; padding: 40px; background: ${coverPageData.backgroundColor}; color: ${coverPageData.textColor}; }
        .document { margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .document h2 { color: #333; }
        .image { max-width: 100%; height: auto; margin: 10px 0; }
        .metadata { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>`

    if (includeCoverPage) {
      htmlContent += `
    <div class="cover">
        <h1>${coverPageData.title}</h1>
        ${coverPageData.subtitle ? `<h2>${coverPageData.subtitle}</h2>` : ""}
        ${coverPageData.author ? `<p>By: ${coverPageData.author}</p>` : ""}
        <p>${coverPageData.date}</p>
        ${coverPageData.description ? `<p>${coverPageData.description}</p>` : ""}
    </div>`
    }

    for (const fileItem of files) {
      htmlContent += `
    <div class="document">
        <h2>${fileItem.name}</h2>`

      if (fileItem.type === "image") {
        htmlContent += `<img src="${fileItem.preview}" alt="${fileItem.name}" class="image" />`
      } else if (fileItem.type === "document" && fileItem.content) {
        htmlContent += `<pre>${fileItem.content}</pre>`
      } else if (fileItem.type === "pdf") {
        htmlContent += `<p><strong>PDF Document</strong> - Size: ${(fileItem.file.size / 1024 / 1024).toFixed(2)} MB</p>`
      }

      if (conversionOptions.includeMetadata) {
        htmlContent += `
        <div class="metadata">
            <strong>File Info:</strong> ${fileItem.type} | ${(fileItem.file.size / 1024).toFixed(2)} KB
        </div>`
      }

      htmlContent += `</div>`
    }

    htmlContent += `
</body>
</html>`

    downloadFile(htmlContent, "converted-documents.html", "text/html")
  }

  const generateMarkdown = async () => {
    let mdContent = ""

    if (includeCoverPage) {
      mdContent += `# ${coverPageData.title}\n\n`
      if (coverPageData.subtitle) mdContent += `## ${coverPageData.subtitle}\n\n`
      if (coverPageData.author) mdContent += `**Author:** ${coverPageData.author}\n\n`
      mdContent += `**Date:** ${coverPageData.date}\n\n`
      if (coverPageData.description) mdContent += `${coverPageData.description}\n\n`
      mdContent += "---\n\n"
    }

    for (const fileItem of files) {
      mdContent += `## ${fileItem.name}\n\n`

      if (fileItem.type === "image") {
        mdContent += `![${fileItem.name}](${fileItem.preview})\n\n`
      } else if (fileItem.type === "document" && fileItem.content) {
        mdContent += "```\n" + fileItem.content + "\n```\n\n"
      } else if (fileItem.type === "pdf") {
        mdContent += `**PDF Document** - Size: ${(fileItem.file.size / 1024 / 1024).toFixed(2)} MB\n\n`
      }

      if (conversionOptions.includeMetadata) {
        mdContent += `*File Info: ${fileItem.type} | ${(fileItem.file.size / 1024).toFixed(2)} KB*\n\n`
      }
    }

    downloadFile(mdContent, "converted-documents.md", "text/markdown")
  }

  const generateCSV = async () => {
    let csvContent = "Filename,Type,Size (KB),Content Preview\n"

    for (const fileItem of files) {
      const sizeKB = (fileItem.file.size / 1024).toFixed(2)
      const preview =
        fileItem.type === "document" && fileItem.content
          ? fileItem.content.substring(0, 100).replace(/"/g, '""').replace(/\n/g, " ")
          : `${fileItem.type} file`

      csvContent += `"${fileItem.name}","${fileItem.type}","${sizeKB}","${preview}"\n`
    }

    downloadFile(csvContent, "converted-documents.csv", "text/csv")
  }

  const generateJSON = async () => {
    const jsonData = {
      metadata: conversionOptions.includeMetadata ? generateMetadata() : null,
      coverPage: includeCoverPage ? coverPageData : null,
      files: files.map((fileItem) => ({
        id: fileItem.id,
        name: fileItem.name,
        type: fileItem.type,
        size: fileItem.file.size,
        content: fileItem.content || null,
        preview: fileItem.type === "image" ? fileItem.preview : null,
      })),
      conversionOptions,
      generatedAt: new Date().toISOString(),
    }

    downloadFile(JSON.stringify(jsonData, null, 2), "converted-documents.json", "application/json")
  }

  const generateRTF = async () => {
    let rtfContent = "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 "

    if (includeCoverPage) {
      rtfContent += `\\qc\\b\\fs36 ${coverPageData.title}\\b0\\fs24\\par\\par`
      if (coverPageData.subtitle) rtfContent += `\\qc\\fs28 ${coverPageData.subtitle}\\fs24\\par\\par`
      if (coverPageData.author) rtfContent += `\\qc By: ${coverPageData.author}\\par\\par`
      rtfContent += `\\qc ${coverPageData.date}\\par\\par`
      if (coverPageData.description) rtfContent += `\\ql ${coverPageData.description}\\par\\par`
      rtfContent += "\\page "
    }

    for (const fileItem of files) {
      rtfContent += `\\b\\fs28 ${fileItem.name}\\b0\\fs24\\par\\par`

      if (fileItem.type === "document" && fileItem.content) {
        rtfContent += fileItem.content.replace(/\n/g, "\\par ") + "\\par\\par"
      } else if (fileItem.type === "image") {
        rtfContent += `[Image file: ${fileItem.name}]\\par\\par`
      } else if (fileItem.type === "pdf") {
        rtfContent += `[PDF file: ${fileItem.name} - ${(fileItem.file.size / 1024 / 1024).toFixed(2)} MB]\\par\\par`
      }
    }

    rtfContent += "}"

    downloadFile(rtfContent, "converted-documents.rtf", "application/rtf")
  }

  const generateZIP = async () => {
    // Note: This is a simplified ZIP generation. In a real app, you'd use a library like JSZip
    const zipContent = `ZIP Archive containing ${files.length} files:\n\n`

    for (const fileItem of files) {
      const content = `File: ${fileItem.name}\nType: ${fileItem.type}\nSize: ${(fileItem.file.size / 1024).toFixed(2)} KB\n\n`
      if (fileItem.type === "document" && fileItem.content) {
        // In a real implementation, you'd add the actual file content to the ZIP
      }
    }

    // This is a placeholder - in production, use JSZip library
    downloadFile(zipContent + "Note: Full ZIP functionality requires JSZip library", "file-list.txt", "text/plain")
  }

  const generateImages = async () => {
    const imageFiles = files.filter((f) => f.type === "image")

    if (imageFiles.length === 0) {
      alert("No images found to convert")
      return
    }

    for (const fileItem of imageFiles) {
      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")!

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          const format = conversionOptions.outputFormat === "png" ? "image/png" : "image/jpeg"
          const quality = conversionOptions.outputFormat === "jpg" ? conversionOptions.imageQuality / 100 : undefined

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const filename = fileItem.name.replace(/\.[^/.]+$/, "") + `.${conversionOptions.outputFormat}`
                downloadFile(blob, filename, format)
              }
              resolve(null)
            },
            format,
            quality,
          )
        }

        img.onerror = reject
        img.src = fileItem.preview
      })
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="w-8 h-8 text-blue-500" />
      case "pdf":
        return <FileText className="w-8 h-8 text-red-500" />
      case "document":
        return <File className="w-8 h-8 text-green-500" />
      default:
        return <File className="w-8 h-8 text-gray-500" />
    }
  }

  const getOutputFormatIcon = (format: string) => {
    switch (format) {
      case "pdf":
        return <FileText className="w-4 h-4" />
      case "html":
        return <Globe className="w-4 h-4" />
      case "json":
        return <Code className="w-4 h-4" />
      case "zip":
        return <Archive className="w-4 h-4" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  const imageFiles = files.filter((f) => f.type === "image")
  const documentFiles = files.filter((f) => f.type === "document")
  const pdfFiles = files.filter((f) => f.type === "pdf")

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Universal Document Converter</h1>
        <p className="text-muted-foreground">Convert images, documents, and PDFs to multiple output formats</p>
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
              <CardDescription>
                Supports images (JPG, PNG, GIF, WebP), documents (TXT, MD, RTF, DOC, DOCX), and PDFs
              </CardDescription>
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
                <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground">Images, Documents, PDFs - All formats supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.md,.rtf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="font-medium">Files ({files.length})</h3>
                      <div className="flex gap-2 text-xs">
                        {imageFiles.length > 0 && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {imageFiles.length} Images
                          </span>
                        )}
                        {documentFiles.length > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            {documentFiles.length} Docs
                          </span>
                        )}
                        {pdfFiles.length > 0 && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded">{pdfFiles.length} PDFs</span>
                        )}
                      </div>
                    </div>
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

                                    <div className="flex-shrink-0">
                                      {fileItem.type === "image" ? (
                                        <img
                                          src={fileItem.preview || "/placeholder.svg"}
                                          alt={fileItem.name}
                                          className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => setSelectedImageForView(fileItem)}
                                        />
                                      ) : (
                                        <div
                                          className="w-12 h-12 flex items-center justify-center border rounded cursor-pointer hover:bg-gray-50"
                                          onClick={() => setSelectedImageForView(fileItem)}
                                        >
                                          {getFileIcon(fileItem.type)}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{fileItem.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {fileItem.type.charAt(0).toUpperCase() + fileItem.type.slice(1)} •{" "}
                                        {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                                      </p>
                                      {fileItem.type === "document" && fileItem.content && (
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                          {fileItem.preview}
                                        </p>
                                      )}
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

              {/* File Viewer Modal */}
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

                    {selectedImageForView.type === "image" ? (
                      <img
                        src={selectedImageForView.preview || "/placeholder.svg"}
                        alt={selectedImageForView.name}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="text-lg font-semibold mb-4">{selectedImageForView.name}</h3>
                        {selectedImageForView.type === "document" && selectedImageForView.content ? (
                          <pre className="whitespace-pre-wrap text-sm">{selectedImageForView.content}</pre>
                        ) : (
                          <div className="text-center py-8">
                            {getFileIcon(selectedImageForView.type)}
                            <p className="mt-2 text-sm text-muted-foreground">
                              {selectedImageForView.type === "pdf"
                                ? "PDF Preview not available"
                                : "Preview not available"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

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
              <CardTitle>Output Format</CardTitle>
              <CardDescription>Choose your preferred output format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="output-format">Format</Label>
                <Select
                  value={conversionOptions.outputFormat}
                  onValueChange={(value: any) => setConversionOptions((prev) => ({ ...prev, outputFormat: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        PDF Document
                      </div>
                    </SelectItem>
                    <SelectItem value="html">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        HTML Web Page
                      </div>
                    </SelectItem>
                    <SelectItem value="md">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4" />
                        Markdown
                      </div>
                    </SelectItem>
                    <SelectItem value="txt">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4" />
                        Text File
                      </div>
                    </SelectItem>
                    <SelectItem value="rtf">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Rich Text Format
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4" />
                        CSV Spreadsheet
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        JSON Data
                      </div>
                    </SelectItem>
                    <SelectItem value="zip">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4" />
                        ZIP Archive
                      </div>
                    </SelectItem>
                    <SelectItem value="png">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        PNG Images
                      </div>
                    </SelectItem>
                    <SelectItem value="jpg">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        JPG Images
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(conversionOptions.outputFormat === "pdf" || conversionOptions.outputFormat === "html") && (
                <>
                  <div>
                    <Label htmlFor="page-size">Page Size</Label>
                    <Select
                      value={conversionOptions.pageSize}
                      onValueChange={(value: "a4" | "letter" | "a3") =>
                        setConversionOptions((prev) => ({ ...prev, pageSize: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a4">A4</SelectItem>
                        <SelectItem value="letter">Letter</SelectItem>
                        <SelectItem value="a3">A3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="orientation">Orientation</Label>
                    <Select
                      value={conversionOptions.orientation}
                      onValueChange={(value: "portrait" | "landscape") =>
                        setConversionOptions((prev) => ({ ...prev, orientation: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {(imageFiles.length > 0 ||
                conversionOptions.outputFormat === "png" ||
                conversionOptions.outputFormat === "jpg") && (
                <div>
                  <Label htmlFor="image-quality">Image Quality: {conversionOptions.imageQuality}%</Label>
                  <input
                    id="image-quality"
                    type="range"
                    min="10"
                    max="100"
                    value={conversionOptions.imageQuality}
                    onChange={(e) =>
                      setConversionOptions((prev) => ({ ...prev, imageQuality: Number.parseInt(e.target.value) }))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-metadata"
                  checked={conversionOptions.includeMetadata}
                  onCheckedChange={(checked) =>
                    setConversionOptions((prev) => ({ ...prev, includeMetadata: checked as boolean }))
                  }
                />
                <Label htmlFor="include-metadata">Include metadata</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="cover-page" checked={includeCoverPage} onCheckedChange={setIncludeCoverPage} />
                <Label htmlFor="cover-page">Include cover page</Label>
              </div>

              <Button onClick={generateDocument} disabled={files.length === 0 || isGenerating} className="w-full">
                {isGenerating ? (
                  "Converting..."
                ) : (
                  <>
                    {getOutputFormatIcon(conversionOptions.outputFormat)}
                    <span className="ml-2">Convert to {conversionOptions.outputFormat.toUpperCase()}</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {imageFiles.length > 0 && (
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
