package org.prakritinetx.fieldflash.ui.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.data.db.entity.QueuedLocationEntity
import java.text.SimpleDateFormat
import java.util.*

class QueuedLocationAdapter(
    private var items: List<QueuedLocationEntity> = emptyList()
) : RecyclerView.Adapter<QueuedLocationAdapter.ViewHolder>() {

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())

    fun updateList(newList: List<QueuedLocationEntity>) {
        items = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_queued_location, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvNodeId.text = "NODE: ${item.nodeId}"

        val accStr = item.accuracy?.let { " (±${String.format(Locale.US, "%.1f", it)}m)" } ?: ""
        holder.tvCoords.text = String.format(Locale.US, "GPS: %.5f°, %.5f°%s", item.latitude, item.longitude, accStr)

        val dateStr = dateFormat.format(Date(item.timestamp))
        val writeStr = if (item.writtenToBoard) "Yes" else "No"
        holder.tvMeta.text = "Ver: ${item.firmwareVersion} | Board Synced: $writeStr | $dateStr"

        holder.tvSyncBadge.text = item.syncStatus
        when (item.syncStatus) {
            "SYNCED" -> {
                holder.tvSyncBadge.setBackgroundResource(R.drawable.bg_badge_success)
                holder.tvSyncBadge.setTextColor(holder.itemView.context.getColor(R.color.text_primary))
            }
            "FAILED" -> {
                holder.tvSyncBadge.setBackgroundResource(R.drawable.bg_badge_error)
                holder.tvSyncBadge.setTextColor(holder.itemView.context.getColor(R.color.text_primary))
            }
            else -> {
                holder.tvSyncBadge.setBackgroundResource(R.drawable.bg_badge_warning)
                holder.tvSyncBadge.setTextColor(holder.itemView.context.getColor(R.color.bg_dark))
            }
        }
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvNodeId: TextView = view.findViewById(R.id.tvNodeId)
        val tvSyncBadge: TextView = view.findViewById(R.id.tvSyncBadge)
        val tvCoords: TextView = view.findViewById(R.id.tvCoords)
        val tvMeta: TextView = view.findViewById(R.id.tvMeta)
    }
}

