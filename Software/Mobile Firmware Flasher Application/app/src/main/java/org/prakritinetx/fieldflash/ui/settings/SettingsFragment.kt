package org.prakritinetx.fieldflash.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import org.prakritinetx.fieldflash.data.api.ApiClient
import org.prakritinetx.fieldflash.databinding.FragmentSettingsBinding
import org.prakritinetx.fieldflash.ui.MainViewModel
import org.prakritinetx.fieldflash.ui.adapter.QueuedLocationAdapter

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()
    private lateinit var queueAdapter: QueuedLocationAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val currentUrl = ApiClient.getInstance(requireContext()).getStoredBaseUrl()
        binding.etBackendUrl.setText(currentUrl)

        setupRecyclerView()
        setupListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        queueAdapter = QueuedLocationAdapter()
        binding.recyclerQueue.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerQueue.adapter = queueAdapter
    }

    private fun setupListeners() {
        binding.btnSaveBackendUrl.setOnClickListener {
            val newUrl = binding.etBackendUrl.text?.toString()?.trim() ?: ""
            if (newUrl.startsWith("http://") || newUrl.startsWith("https://")) {
                ApiClient.getInstance(requireContext()).updateBaseUrl(newUrl)
                Toast.makeText(requireContext(), "Backend URL updated successfully.", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), "URL must start with http:// or https://", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnSyncNow.setOnClickListener {
            viewModel.syncPendingRecordsNow()
        }

        binding.btnClearSynced.setOnClickListener {
            viewModel.clearSyncedRecords()
        }
    }

    private fun observeViewModel() {
        viewModel.allQueuedLocations.observe(viewLifecycleOwner) { list ->
            queueAdapter.updateList(list)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

