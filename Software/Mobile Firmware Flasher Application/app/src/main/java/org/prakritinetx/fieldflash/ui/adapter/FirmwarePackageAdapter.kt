package org.prakritinetx.fieldflash.ui.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.data.models.FirmwarePackage

class FirmwarePackageAdapter(
    private var items: List<FirmwarePackage> = emptyList(),
    private val onSelect: (FirmwarePackage) -> Unit,
    private val onDownload: (FirmwarePackage) -> Unit
) : RecyclerView.Adapter<FirmwarePackageAdapter.ViewHolder>() {

    private var selectedId: String? = null

    fun updateList(newList: List<FirmwarePackage>, currentSelectedId: String? = null) {
        items = newList
        selectedId = currentSelectedId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_firmware_package, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvTitle.text = item.displayName
        holder.tvChip.text = item.chipType.uppercase()
        holder.tvVersion.text = item.version
        holder.tvNodeType.text = "Node Type: ${item.nodeType}"
        holder.tvDescription.text = item.description.ifBlank { "Firmware package for ${item.nodeType} node" }

        val isSelected = item.id == selectedId
        if (isSelected) {
            holder.btnSelect.text = "SELECTED"
            holder.btnSelect.isEnabled = false
        } else {
            holder.btnSelect.text = "SELECT"
            holder.btnSelect.isEnabled = true
        }

        if (item.isCachedLocally) {
            holder.tvCacheStatus.text = "● Cached Locally"
            holder.tvCacheStatus.setTextColor(holder.itemView.context.getColor(R.color.status_success))
            holder.btnDownload.visibility = View.GONE
        } else {
            holder.tvCacheStatus.text = "○ Cloud Only (Download Needed)"
            holder.tvCacheStatus.setTextColor(holder.itemView.context.getColor(R.color.status_warning))
            holder.btnDownload.visibility = View.VISIBLE
        }

        holder.btnSelect.setOnClickListener {
            selectedId = item.id
            notifyDataSetChanged()
            onSelect(item)
        }

        holder.btnDownload.setOnClickListener {
            onDownload(item)
        }
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvTitle: TextView = view.findViewById(R.id.tvPackageTitle)
        val tvChip: TextView = view.findViewById(R.id.tvChipBadge)
        val tvVersion: TextView = view.findViewById(R.id.tvVersionBadge)
        val tvNodeType: TextView = view.findViewById(R.id.tvNodeType)
        val tvDescription: TextView = view.findViewById(R.id.tvDescription)
        val tvCacheStatus: TextView = view.findViewById(R.id.tvCacheStatus)
        val btnDownload: Button = view.findViewById(R.id.btnDownload)
        val btnSelect: Button = view.findViewById(R.id.btnSelect)
    }
}

