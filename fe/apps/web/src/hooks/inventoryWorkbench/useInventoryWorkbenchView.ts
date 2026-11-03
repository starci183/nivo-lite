"use client"
import {
    INVENTORY_TABS,
    type DataSlot,
    type SlotLabels,
    type PoStatus,
    type SupplierFormValues,
    type InventoryTemplateChoice,
    type SupplierFormField,
} from "@/modules/types"
import { useAppSelector } from "@/redux"
import { useAgentWorkbenchShell } from "@/hooks/agentDashboard"
import { EMPTY_INVENTORY_BOARD } from "./inventoryWorkbench.shared"
import { mapSlot, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useInventoryWorkbenchData } from "./useInventoryWorkbenchData"
import { useInventoryFiguresView } from "./useInventoryFiguresView"
import { useInventoryStockView } from "./useInventoryStockView"
import { useInventoryOrdersView } from "./useInventoryOrdersView"
import { useInventoryPendingView } from "./useInventoryPendingView"
import { useInventorySuppliersView } from "./useInventorySuppliersView"
import { useInventoryHistoryView } from "./useInventoryHistoryView"
import { useInventoryRecipesView } from "./useInventoryRecipesView"
import { useInventoryCountView } from "./useInventoryCountView"
import { useInventoryImportView } from "./useInventoryImportView"
import type { Figure, BadgeTone } from "@starci/grammar/common"
import type { StockFilter, ItemFormValues, AdjustMode, ItemFormField } from "@/hooks/inventory"

type InventoryTab = (typeof INVENTORY_TABS)[number]
/** The server-resolved installation, deep link and all seven original tab labels. */
interface InventoryWorkbenchInput {
    readonly installationId: string
    readonly initialTab: string | null
    readonly tabs: Readonly<Record<InventoryTab, string>>
}
/** The view `useInventoryWorkbenchView` returns. */
export interface InventoryWorkbenchView {
    readonly shape: "explanation" | "history" | "count" | "orders" | "import" | "suppliers" | "recipes" | "stock"
    readonly props: {
        readonly ribbon: {
            readonly label: string
            readonly slot: DataSlot<readonly Figure[]>
            readonly placeholder: readonly Figure[]
            readonly labels: SlotLabels
        }
        readonly panel: {
            readonly slot: DataSlot<{
                stock: {
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly addLabel: string | null
                    readonly draftLabel: string | null
                    readonly filterLabel: string
                    readonly filters: {
                        value: StockFilter
                        label: string
                    }[]
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly adjustLabel: string
                    readonly editLabel: string | null
                    readonly toggleInactiveLabel: string | null
                    readonly query: string
                    readonly filter: StockFilter
                    readonly rows: {
                        id: string
                        name: string
                        statusLabel: string
                        statusTone: "success" | "neutral" | "danger" | "warning"
                        onOrderLabel: string | null
                        detail: string
                        total: string
                        stepLabel: string
                        lessLabel: string
                        moreLabel: string
                    }[]
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly notice: string | null
                    readonly itemDrawer: {
                        copy: {
                            itemEditTitle: string
                            close: string
                            save: string
                            itemAddTitle: string
                            itemDrawerHint: string
                            itemName: string
                            itemSku: string
                            itemSkuHint: string
                            itemUnit: string
                            itemUnitHint: string
                            itemUnits: string
                            itemUnitsHint: string
                            itemCategory: string
                            itemSupplier: string
                            itemSupplierNone: string
                            itemCost: string
                            itemSell: string
                            itemReorderPoint: string
                            itemReorderPointHint: string
                            itemReorderQty: string
                            itemAliases: string
                            itemAliasesHint: string
                            itemOpening: string
                            itemStop: string
                            itemResume: string
                        }
                        editing: string | null
                        active: boolean | null
                        values: ItemFormValues
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                    readonly adjustDrawer: {
                        copy: {
                            readonly adjustTitle: string
                            readonly close: string
                            readonly adjustMode: string
                            readonly adjustFrom: string
                            readonly adjustAt: string
                            readonly adjustTo: string
                            readonly adjustToHint: string
                            readonly adjustNote: string
                            readonly adjustReason: string
                            readonly adjustReasonHint: string
                            readonly valueLabel: string
                        }
                        itemName: string
                        unit: string
                        summary: string
                        modes: {
                            value: string
                            label: string
                        }[]
                        mode: AdjustMode
                        isMove: boolean
                        showPlaces: boolean
                        places: {
                            id: string
                            label: string
                        }[]
                        targets: {
                            id: string
                            label: string
                        }[]
                        from: string
                        to: string
                        value: string
                        reason: string
                        preview: string | null
                        submitLabel: string
                        canSubmit: boolean
                        isPending: boolean
                        error: string | null
                        notice: string | null
                    } | null
                }
                orders: {
                    readonly createLabel: string | null
                    readonly openCount: string
                    readonly boardLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly openLabel: string
                    readonly hasOrders: boolean
                    readonly lanes: {
                        status: PoStatus
                        label: string
                        count: string
                        cards: {
                            id: string
                            poNo: string
                            statusLabel: string
                            statusTone: "success" | "neutral" | "warning" | "accent"
                            supplier: string
                            facts: string
                            copyNote: string | null
                        }[]
                    }[]
                    readonly poDrawer: {
                        copy: {
                            readonly approveAndSend: string
                            readonly close: string
                            readonly poCancel: string
                            readonly poCopied: string
                            readonly poCopy: string
                            readonly poExpected: string
                            readonly poExpectedHint: string
                            readonly poInvoice: string
                            readonly poInvoiceHint: string
                            readonly poItems: string
                            readonly poMessageDrafted: string
                            readonly poMessageHint: string
                            readonly poQty: string
                            readonly poReceive: string
                            readonly poReceiveCost: string
                            readonly poReceiveHint: string
                            readonly poReceiveQty: string
                            readonly poRemind: string
                            readonly poSaveDraft: string
                            readonly poSendForApproval: string
                            readonly poSentEmail: string
                            readonly poSupplier: string
                            readonly poSupplierHint: string
                            readonly poUnitCost: string
                            readonly reject: string
                        }
                        title: string
                        description: string
                        mode: "read" | "edit" | "receive"
                        summary: string
                        supplierId: string
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        expected: string
                        lines: {
                            id: string
                            name: string
                            hint: string
                            qty: string
                            cost: string
                        }[]
                        readLines: {
                            id: string
                            text: string
                        }[]
                        total: string
                        invoiceNo: string
                        messageTitle: string
                        message: string
                        messageEditable: boolean
                        sendNote: string | null
                        sentByEmail: boolean
                        canEdit: boolean
                        canApprove: boolean
                        canReceive: boolean
                        canCopy: boolean
                        canCancel: boolean
                        copied: boolean
                        isPending: boolean
                        error: string | null
                        notice: string | null
                    } | null
                    readonly newPoDrawer: {
                        copy: {
                            readonly newPoTitle: string
                            readonly newPoHint: string
                            readonly close: string
                            readonly poSupplier: string
                            readonly poSupplierHint: string
                            readonly newPoItemHint: string
                            readonly poQty: string
                            readonly poUnitCost: string
                            readonly newPoAddLine: string
                            readonly newPoCreate: string
                        }
                        supplierId: string
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        items: {
                            id: string
                            label: string
                        }[]
                        lines: {
                            itemLabel: string
                            key: string
                            itemId: string
                            qty: string
                            cost: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                pending: {
                    readonly title: string
                    readonly description: string
                    readonly count: number
                    readonly rejectLabel: string
                    readonly rows: {
                        id: string
                        summary: string
                        draft: string | null
                        approveLabel: string
                    }[]
                    readonly isPending: boolean
                    readonly error: string | null
                }
                suppliers: {
                    readonly addLabel: string | null
                    readonly editLabel: string | null
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly rows: {
                        id: string
                        name: string
                        channelLabel: string
                        detail: string
                        itemsText: string
                    }[]
                    readonly locationsTitle: string
                    readonly locationsText: string
                    readonly canAddLocation: boolean
                    readonly locationLabel: string
                    readonly locationAddLabel: string
                    readonly locationName: string
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly drawer: {
                        copy: {
                            supplierEditTitle: string
                            close: string
                            save: string
                            supplierAddTitle: string
                            supplierDrawerHint: string
                            supplierName: string
                            supplierContact: string
                            supplierChannel: string
                            supplierEmail: string
                            supplierPhone: string
                            supplierZalo: string
                            supplierLead: string
                            supplierTerms: string
                            supplierNote: string
                        }
                        editing: string | null
                        values: SupplierFormValues
                        channels: {
                            value: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                history: {
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly kindLabel: string
                    readonly kinds: readonly [
                        {
                            readonly value: "all"
                            readonly label: string
                        },
                        {
                            readonly value: "in"
                            readonly label: string
                        },
                        {
                            readonly value: "out"
                            readonly label: string
                        },
                        {
                            readonly value: "adjust"
                            readonly label: string
                        },
                    ]
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly query: string
                    readonly kind: string
                    readonly rows: {
                        id: string
                        kindLabel: string
                        kindTone: "success" | "neutral" | "warning" | "accent"
                        itemName: string
                        quantity: string
                        detail: string
                        evidence: string | null
                        stamp: string
                    }[]
                }
                recipes: {
                    readonly addLabel: string | null
                    readonly addDisabled: boolean
                    readonly editLabel: string | null
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly rows: {
                        id: string
                        title: string
                        detail: string
                    }[]
                    readonly drawer: {
                        copy: {
                            recipeEditTitle: string
                            close: string
                            save: string
                            recipeAddTitle: string
                            recipeDrawerHint: string
                            recipeName: string
                            recipeNameHint: string
                            recipeAliases: string
                            recipeAliasesHint: string
                            recipeIngredients: string
                            recipeIngredientHint: string
                            recipeRemoveLine: string
                            recipeAddLine: string
                            recipeDelete: string
                        }
                        editing: string | null
                        name: string
                        aliases: string
                        lines: {
                            ingredientLabel: string
                            quantityLabel: string
                            unit: string
                            key: string
                            itemId: string
                            qty: string
                        }[]
                        items: {
                            id: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                count: {
                    readonly intro: string
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly submitLabel: string
                    readonly query: string
                    readonly rows: {
                        id: string
                        name: string
                        machine: string
                        fieldLabel: string
                        unit: string
                        value: string
                    }[]
                    readonly canSubmit: boolean
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly notice: string | null
                }
            }>
            readonly placeholder: {
                stock: {
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly addLabel: string | null
                    readonly draftLabel: string | null
                    readonly filterLabel: string
                    readonly filters: {
                        value: StockFilter
                        label: string
                    }[]
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly adjustLabel: string
                    readonly editLabel: string | null
                    readonly toggleInactiveLabel: string | null
                    readonly query: string
                    readonly filter: StockFilter
                    readonly rows: {
                        id: string
                        name: string
                        statusLabel: string
                        statusTone: "success" | "neutral" | "danger" | "warning"
                        onOrderLabel: string | null
                        detail: string
                        total: string
                        stepLabel: string
                        lessLabel: string
                        moreLabel: string
                    }[]
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly notice: string | null
                    readonly itemDrawer: {
                        copy: {
                            itemEditTitle: string
                            close: string
                            save: string
                            itemAddTitle: string
                            itemDrawerHint: string
                            itemName: string
                            itemSku: string
                            itemSkuHint: string
                            itemUnit: string
                            itemUnitHint: string
                            itemUnits: string
                            itemUnitsHint: string
                            itemCategory: string
                            itemSupplier: string
                            itemSupplierNone: string
                            itemCost: string
                            itemSell: string
                            itemReorderPoint: string
                            itemReorderPointHint: string
                            itemReorderQty: string
                            itemAliases: string
                            itemAliasesHint: string
                            itemOpening: string
                            itemStop: string
                            itemResume: string
                        }
                        editing: string | null
                        active: boolean | null
                        values: ItemFormValues
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                    readonly adjustDrawer: {
                        copy: {
                            readonly adjustTitle: string
                            readonly close: string
                            readonly adjustMode: string
                            readonly adjustFrom: string
                            readonly adjustAt: string
                            readonly adjustTo: string
                            readonly adjustToHint: string
                            readonly adjustNote: string
                            readonly adjustReason: string
                            readonly adjustReasonHint: string
                            readonly valueLabel: string
                        }
                        itemName: string
                        unit: string
                        summary: string
                        modes: {
                            value: string
                            label: string
                        }[]
                        mode: AdjustMode
                        isMove: boolean
                        showPlaces: boolean
                        places: {
                            id: string
                            label: string
                        }[]
                        targets: {
                            id: string
                            label: string
                        }[]
                        from: string
                        to: string
                        value: string
                        reason: string
                        preview: string | null
                        submitLabel: string
                        canSubmit: boolean
                        isPending: boolean
                        error: string | null
                        notice: string | null
                    } | null
                }
                orders: {
                    readonly createLabel: string | null
                    readonly openCount: string
                    readonly boardLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly openLabel: string
                    readonly hasOrders: boolean
                    readonly lanes: {
                        status: PoStatus
                        label: string
                        count: string
                        cards: {
                            id: string
                            poNo: string
                            statusLabel: string
                            statusTone: "success" | "neutral" | "warning" | "accent"
                            supplier: string
                            facts: string
                            copyNote: string | null
                        }[]
                    }[]
                    readonly poDrawer: {
                        copy: {
                            readonly approveAndSend: string
                            readonly close: string
                            readonly poCancel: string
                            readonly poCopied: string
                            readonly poCopy: string
                            readonly poExpected: string
                            readonly poExpectedHint: string
                            readonly poInvoice: string
                            readonly poInvoiceHint: string
                            readonly poItems: string
                            readonly poMessageDrafted: string
                            readonly poMessageHint: string
                            readonly poQty: string
                            readonly poReceive: string
                            readonly poReceiveCost: string
                            readonly poReceiveHint: string
                            readonly poReceiveQty: string
                            readonly poRemind: string
                            readonly poSaveDraft: string
                            readonly poSendForApproval: string
                            readonly poSentEmail: string
                            readonly poSupplier: string
                            readonly poSupplierHint: string
                            readonly poUnitCost: string
                            readonly reject: string
                        }
                        title: string
                        description: string
                        mode: "read" | "edit" | "receive"
                        summary: string
                        supplierId: string
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        expected: string
                        lines: {
                            id: string
                            name: string
                            hint: string
                            qty: string
                            cost: string
                        }[]
                        readLines: {
                            id: string
                            text: string
                        }[]
                        total: string
                        invoiceNo: string
                        messageTitle: string
                        message: string
                        messageEditable: boolean
                        sendNote: string | null
                        sentByEmail: boolean
                        canEdit: boolean
                        canApprove: boolean
                        canReceive: boolean
                        canCopy: boolean
                        canCancel: boolean
                        copied: boolean
                        isPending: boolean
                        error: string | null
                        notice: string | null
                    } | null
                    readonly newPoDrawer: {
                        copy: {
                            readonly newPoTitle: string
                            readonly newPoHint: string
                            readonly close: string
                            readonly poSupplier: string
                            readonly poSupplierHint: string
                            readonly newPoItemHint: string
                            readonly poQty: string
                            readonly poUnitCost: string
                            readonly newPoAddLine: string
                            readonly newPoCreate: string
                        }
                        supplierId: string
                        suppliers: {
                            id: string
                            label: string
                        }[]
                        items: {
                            id: string
                            label: string
                        }[]
                        lines: {
                            itemLabel: string
                            key: string
                            itemId: string
                            qty: string
                            cost: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                pending: {
                    readonly title: string
                    readonly description: string
                    readonly count: number
                    readonly rejectLabel: string
                    readonly rows: {
                        id: string
                        summary: string
                        draft: string | null
                        approveLabel: string
                    }[]
                    readonly isPending: boolean
                    readonly error: string | null
                }
                suppliers: {
                    readonly addLabel: string | null
                    readonly editLabel: string | null
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly rows: {
                        id: string
                        name: string
                        channelLabel: string
                        detail: string
                        itemsText: string
                    }[]
                    readonly locationsTitle: string
                    readonly locationsText: string
                    readonly canAddLocation: boolean
                    readonly locationLabel: string
                    readonly locationAddLabel: string
                    readonly locationName: string
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly drawer: {
                        copy: {
                            supplierEditTitle: string
                            close: string
                            save: string
                            supplierAddTitle: string
                            supplierDrawerHint: string
                            supplierName: string
                            supplierContact: string
                            supplierChannel: string
                            supplierEmail: string
                            supplierPhone: string
                            supplierZalo: string
                            supplierLead: string
                            supplierTerms: string
                            supplierNote: string
                        }
                        editing: string | null
                        values: SupplierFormValues
                        channels: {
                            value: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                history: {
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly kindLabel: string
                    readonly kinds: readonly [
                        {
                            readonly value: "all"
                            readonly label: string
                        },
                        {
                            readonly value: "in"
                            readonly label: string
                        },
                        {
                            readonly value: "out"
                            readonly label: string
                        },
                        {
                            readonly value: "adjust"
                            readonly label: string
                        },
                    ]
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly query: string
                    readonly kind: string
                    readonly rows: {
                        id: string
                        kindLabel: string
                        kindTone: "success" | "neutral" | "warning" | "accent"
                        itemName: string
                        quantity: string
                        detail: string
                        evidence: string | null
                        stamp: string
                    }[]
                }
                recipes: {
                    readonly addLabel: string | null
                    readonly addDisabled: boolean
                    readonly editLabel: string | null
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly rows: {
                        id: string
                        title: string
                        detail: string
                    }[]
                    readonly drawer: {
                        copy: {
                            recipeEditTitle: string
                            close: string
                            save: string
                            recipeAddTitle: string
                            recipeDrawerHint: string
                            recipeName: string
                            recipeNameHint: string
                            recipeAliases: string
                            recipeAliasesHint: string
                            recipeIngredients: string
                            recipeIngredientHint: string
                            recipeRemoveLine: string
                            recipeAddLine: string
                            recipeDelete: string
                        }
                        editing: string | null
                        name: string
                        aliases: string
                        lines: {
                            ingredientLabel: string
                            quantityLabel: string
                            unit: string
                            key: string
                            itemId: string
                            qty: string
                        }[]
                        items: {
                            id: string
                            label: string
                        }[]
                        isPending: boolean
                        error: string | null
                    } | null
                }
                count: {
                    readonly intro: string
                    readonly searchLabel: string
                    readonly searchPlaceholder: string
                    readonly clearLabel: string
                    readonly listLabel: string
                    readonly emptyTitle: string
                    readonly emptyBody: string
                    readonly submitLabel: string
                    readonly query: string
                    readonly rows: {
                        id: string
                        name: string
                        machine: string
                        fieldLabel: string
                        unit: string
                        value: string
                    }[]
                    readonly canSubmit: boolean
                    readonly isPending: boolean
                    readonly error: string | null
                    readonly notice: string | null
                }
            }
            readonly labels: SlotLabels
        }
        readonly importPanel: {
            readonly slot: DataSlot<{
                readonly allowed: boolean
                readonly deniedTitle: string
                readonly deniedBody: string
                readonly pasteTitle: string
                readonly pasteHelp: string
                readonly pasteLabel: string
                readonly pastePlaceholder: string
                readonly pasteSubmit: string
                readonly text: string
                readonly startTitle: string
                readonly startFooter: string
                readonly loadLabel: string
                readonly templates: InventoryTemplateChoice[]
                readonly isPending: boolean
                readonly error: string | null
                readonly notice: string | null
            }>
            readonly placeholder: {
                readonly allowed: boolean
                readonly deniedTitle: string
                readonly deniedBody: string
                readonly pasteTitle: string
                readonly pasteHelp: string
                readonly pasteLabel: string
                readonly pastePlaceholder: string
                readonly pasteSubmit: string
                readonly text: string
                readonly startTitle: string
                readonly startFooter: string
                readonly loadLabel: string
                readonly templates: InventoryTemplateChoice[]
                readonly isPending: boolean
                readonly error: string | null
                readonly notice: string | null
            }
            readonly labels: SlotLabels
        }
        readonly why: {
            view: null
            labels: {
                pathLabel: string
                factsLabel: string
                sourcesLabel: string
                approverLabel: string
                timeLabel: string
                openOnMap: string
                missingTitle: string
                missingBody: string
            }
            closeLabel: string
            openLabel: string
            paneLabel: string
            listLabel: string
            workItemId: string | null
        }
        readonly regions: {
            waiting: {
                label: string
                slot: DataSlot<{
                    count: string | null
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    count: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    openLabel: string
                    more: string | null
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            done: {
                label: string
                slot: DataSlot<{
                    count: string
                    logLabel: string
                    logHref: string
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    count: string
                    logLabel: string
                    logHref: string
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            connections: {
                label: string
                slot: DataSlot<{
                    manageLabel: string
                    manageHref: "/connections"
                    rows: {
                        id: string
                        name: string
                        description: string
                        statusLabel: string
                        statusTone: BadgeTone
                        accessLabel: string
                    }[]
                    emptyMessage: string
                    emptyDescription: string
                }>
                placeholder: {
                    rows: {
                        name: string
                        statusLabel: string
                        statusTone: "neutral"
                        accessLabel: string
                        id: string
                        title: string
                        description: string
                        href: string
                    }[]
                    manageLabel: string
                    manageHref: "/connections"
                    emptyMessage: string
                    emptyDescription: string
                }
                labels: SlotLabels
            }
            knowledge: {
                label: string
                slot: DataSlot<{
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }>
                placeholder: {
                    openLabel: string
                    openHref: string
                    footer: string
                    publicTitle: string
                    publicDescription: string
                    internalTitle: string
                    internalDescription: string
                    gaps: {
                        label: string
                        count: string | null
                        openLabel: string
                        openHref: string
                        rows: {
                            id: string
                            title: string
                            description: string
                            asked: string
                        }[]
                        emptyMessage: string
                        emptyDescription: string
                    } | null
                }
                labels: SlotLabels
            }
        }
        readonly tabsLabel: string
        readonly selectedTab: "history" | "count" | "orders" | "import" | "suppliers" | "recipes" | "stock"
        readonly tabs: {
            id: "history" | "count" | "orders" | "import" | "suppliers" | "recipes" | "stock"
            label: string
        }[]
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly closeWhy: () => void
        readonly retryDashboard: () => void
        readonly retryPanel: () => Promise<
            | {
                  canManage: boolean
                  defaultLocationId: string | null
                  nowIso: string
                  stockOuts7d: number | null
                  items: Array<{
                      active: boolean
                      aliases: Array<string>
                      category: string
                      costVnd: number
                      id: string
                      name: string
                      onOrder: number
                      reorderPoint: number
                      reorderQty: number
                      sellPriceVnd: number | null
                      sku: string
                      status: string
                      supplierId: string | null
                      total: number
                      unit: string
                      levels: Array<{
                          locationId: string
                          qty: number
                      }>
                      units: Array<{
                          factor: number
                          unit: string
                      }>
                  }>
                  locations: Array<{
                      id: string
                      name: string
                  }>
                  metrics: {
                      itemCount: number
                      lowCount: number
                      openPos: number
                      outCount: number
                      pendingCount: number
                      valueVnd: number
                  }
                  movements: Array<{
                      byName: string
                      createdAt: string
                      evidence: string
                      id: string
                      itemName: string
                      kind: string
                      qty: number
                      qtyAfter: number
                      reason: string
                      refLabel: string
                      unit: string
                  }>
                  pending: Array<{
                      action: string
                      createdAt: string
                      draft: string | null
                      id: string
                      poId: string | null
                      summary: string
                  }>
                  pos: Array<{
                      channel: string | null
                      createdAt: string
                      expectedAt: string | null
                      id: string
                      message: string
                      poNo: string
                      reminders: number
                      sendNote: string | null
                      sentVia: string | null
                      source: string
                      status: string
                      supplierId: string | null
                      supplierName: string
                      totalVnd: number
                      workItemId: string | null
                      lines: Array<{
                          id: string
                          itemId: string
                          name: string
                          qtyOrdered: number
                          qtyReceived: number
                          unit: string
                          unitCost: number
                      }>
                  }>
                  recipes: Array<{
                      aliases: Array<string>
                      id: string
                      name: string
                      lines: Array<{
                          itemId: string
                          name: string
                          qty: number
                          unit: string
                      }>
                  }>
                  suppliers: Array<{
                      channel: string
                      contactName: string
                      email: string
                      id: string
                      leadTimeDays: number
                      name: string
                      note: string
                      paymentTerms: string
                      phone: string
                      zalo: string
                  }>
              }
            | undefined
        >
        readonly retryImport: () => Promise<
            [
                (
                    | {
                          canManage: boolean
                          defaultLocationId: string | null
                          nowIso: string
                          stockOuts7d: number | null
                          items: Array<{
                              active: boolean
                              aliases: Array<string>
                              category: string
                              costVnd: number
                              id: string
                              name: string
                              onOrder: number
                              reorderPoint: number
                              reorderQty: number
                              sellPriceVnd: number | null
                              sku: string
                              status: string
                              supplierId: string | null
                              total: number
                              unit: string
                              levels: Array<{
                                  locationId: string
                                  qty: number
                              }>
                              units: Array<{
                                  factor: number
                                  unit: string
                              }>
                          }>
                          locations: Array<{
                              id: string
                              name: string
                          }>
                          metrics: {
                              itemCount: number
                              lowCount: number
                              openPos: number
                              outCount: number
                              pendingCount: number
                              valueVnd: number
                          }
                          movements: Array<{
                              byName: string
                              createdAt: string
                              evidence: string
                              id: string
                              itemName: string
                              kind: string
                              qty: number
                              qtyAfter: number
                              reason: string
                              refLabel: string
                              unit: string
                          }>
                          pending: Array<{
                              action: string
                              createdAt: string
                              draft: string | null
                              id: string
                              poId: string | null
                              summary: string
                          }>
                          pos: Array<{
                              channel: string | null
                              createdAt: string
                              expectedAt: string | null
                              id: string
                              message: string
                              poNo: string
                              reminders: number
                              sendNote: string | null
                              sentVia: string | null
                              source: string
                              status: string
                              supplierId: string | null
                              supplierName: string
                              totalVnd: number
                              workItemId: string | null
                              lines: Array<{
                                  id: string
                                  itemId: string
                                  name: string
                                  qtyOrdered: number
                                  qtyReceived: number
                                  unit: string
                                  unitCost: number
                              }>
                          }>
                          recipes: Array<{
                              aliases: Array<string>
                              id: string
                              name: string
                              lines: Array<{
                                  itemId: string
                                  name: string
                                  qty: number
                                  unit: string
                              }>
                          }>
                          suppliers: Array<{
                              channel: string
                              contactName: string
                              email: string
                              id: string
                              leadTimeDays: number
                              name: string
                              note: string
                              paymentTerms: string
                              phone: string
                              zalo: string
                          }>
                      }
                    | undefined
                ),
                (
                    | {
                          description: string
                          key: string
                          name: string
                      }[]
                    | undefined
                ),
            ]
        >
        readonly stock: {
            readonly onQuery: (value: string) => void
            readonly onFilter: (value: string) => void
            readonly onAdd: () => void
            readonly onDraft: () => void
            readonly onQuick: (id: string, sign: 1 | -1) => void
            readonly onAdjust: (id: string) => void
            readonly onEdit: (id: string) => void
            readonly onToggleInactive: () => void
            readonly onItemField: (name: ItemFormField, value: string) => void
            readonly onItemSave: () => void
            readonly onItemToggle: () => void
            readonly onItemClose: () => void
            readonly onAdjustMode: (next: string) => void
            readonly onAdjustFrom: (from: string) => void
            readonly onAdjustTo: (to: string) => void
            readonly onAdjustValue: (value: string) => void
            readonly onAdjustReason: (reason: string) => void
            readonly onAdjustSubmit: () => void
            readonly onAdjustClose: () => void
        }
        readonly orders: {
            readonly onCreate: () => void
            readonly onOpen: (id: string) => void
            readonly onPoSupplier: (supplierId: string) => void
            readonly onPoExpected: (expected: string) => void
            readonly onPoLine: (index: number, field: "qty" | "cost", value: string) => void
            readonly onPoInvoice: (invoiceNo: string) => void
            readonly onPoMessage: (message: string) => void
            readonly onPoSaveDraft: () => void
            readonly onPoSendForApproval: () => void
            readonly onPoApprove: () => void
            readonly onPoReject: () => void
            readonly onPoReceive: () => void
            readonly onPoRemind: () => void
            readonly onPoCopy: () => void
            readonly onPoCancel: () => void
            readonly onPoClose: () => void
            readonly onNewSupplier: (supplierId: string) => void
            readonly onNewPick: (index: number, itemId: string) => void
            readonly onNewQty: (index: number, qty: string) => void
            readonly onNewCost: (index: number, cost: string) => void
            readonly onNewAddLine: () => void
            readonly onNewCreate: () => void
            readonly onNewClose: () => void
        }
        readonly pending: {
            readonly onApprove: (id: string) => void
            readonly onReject: (id: string) => void
        }
        readonly suppliers: {
            readonly onAdd: () => void
            readonly onEdit: (id: string) => void
            readonly onLocationName: (value: string) => void
            readonly onAddLocation: () => void
            readonly onSupplierField: (name: SupplierFormField, value: string) => void
            readonly onSupplierSave: () => void
            readonly onSupplierClose: () => void
        }
        readonly history: {
            readonly onQuery: (value: string) => void
            readonly onKind: (value: string) => void
        }
        readonly recipes: {
            readonly onAdd: () => void
            readonly onEdit: (id: string) => void
            readonly onRecipeName: (name: string) => void
            readonly onRecipeAliases: (aliases: string) => void
            readonly onRecipeItem: (index: number, itemId: string) => void
            readonly onRecipeQty: (index: number, qty: string) => void
            readonly onRecipeRemoveLine: (index: number) => void
            readonly onRecipeAddLine: () => void
            readonly onRecipeSave: () => void
            readonly onRecipeRemove: () => void
            readonly onRecipeClose: () => void
        }
        readonly count: {
            readonly onQuery: (value: string) => void
            readonly onCount: (id: string, value: string) => void
            readonly onSubmit: () => void
        }
        readonly imports: {
            readonly onText: (value: string) => void
            readonly onPaste: () => void
            readonly onLoad: (key: string) => void
        }
    }
}

/** Owns inventory read scopes, independent common regions and the actual conditional tab lifetimes. */
export const useInventoryWorkbenchView = (input: InventoryWorkbenchInput): InventoryWorkbenchView => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const scope = JSON.stringify([workspaceId ?? null, input.installationId])
    const {
        tabs,
        dashboard: frame,
        isNormal: overview,
        frameOf,
    } = useAgentWorkbenchShell({
        module: "inventory",
        installationId: input.installationId,
        ids: INVENTORY_TABS,
        initialTab: input.initialTab,
    })
    const data = useInventoryWorkbenchData(overview),
        board = data.data ?? EMPTY_INVENTORY_BOARD
    const of = (id: InventoryTab) => ({ board, isActive: overview && tabs.selected === id, scope })
    const figures = useInventoryFiguresView(of(tabs.selected))
    const stock = useInventoryStockView(of("stock")),
        orders = useInventoryOrdersView(of("orders")),
        pending = useInventoryPendingView(of("orders"))
    const suppliers = useInventorySuppliersView(of("suppliers")),
        history = useInventoryHistoryView(of("history")),
        recipes = useInventoryRecipesView(of("recipes"))
    const count = useInventoryCountView(of("count")),
        imports = useInventoryImportView(of("import"))
    const labels = useSlotLabels()
    const panel = {
        stock: stock.props,
        orders: orders.props,
        pending: pending.props,
        suppliers: suppliers.props,
        history: history.props,
        recipes: recipes.props,
        count: count.props,
    }
    const slotLabels = labels(input.tabs[tabs.selected])
    return {
        shape: overview ? tabs.selected : ("explanation" as const),
        props: {
            ...frameOf(input.tabs),
            ribbon: {
                label: figures.label,
                slot: mapSlot(data.slot, () => figures.items),
                placeholder: figures.items,
                labels: slotLabels,
            },
            panel: { slot: mapSlot(data.slot, () => panel), placeholder: panel, labels: slotLabels },
            importPanel: {
                slot: slotOfReads([data.read, imports.templateRead], () => imports.props),
                placeholder: imports.props,
                labels: slotLabels,
            },
        },
        on: {
            selectTab: tabs.select,
            closeWhy: frame.closeWhy,
            retryDashboard: frame.reload,
            retryPanel: data.reload,
            retryImport: () => Promise.all([data.reload(), imports.retryTemplates()]),
            stock: stock.on,
            orders: orders.on,
            pending: pending.on,
            suppliers: suppliers.on,
            history: history.on,
            recipes: recipes.on,
            count: count.on,
            imports: imports.on,
        },
    } as const
}
