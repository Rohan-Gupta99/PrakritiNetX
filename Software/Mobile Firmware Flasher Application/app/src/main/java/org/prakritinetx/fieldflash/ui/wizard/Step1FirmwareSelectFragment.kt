package org.prakritinetx.fieldflash.ui.wizard

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.data.models.FirmwarePackage
import org.prakritinetx.fieldflash.databinding.FragmentStep1FirmwareBinding
import org.prakritinetx.fieldflash.ui.MainActivity
import org.prakritinetx.fieldflash.ui.MainViewModel
import org.prakritinetx.fieldflash.ui.adapter.FirmwarePackageAdapter

class Step1FirmwareSelectFragment : Fragment() {

    private var _binding: FragmentStep1FirmwareBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()
    private lateinit var packageAdapter: FirmwarePackageAdapter

    private val safFilePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data?.data != null) {
            val uri = result.data!!.data!!
            val uriString = uri.toString().lowercase()
            val isK210 = uriString.contains("k210") || uriString.endsWith(".kfpkg")
            val chipType = if (isK210) "k210" else "esp32"
            val nodeType = if (isK210) "fire-k210" else "water-esp32"

            viewModel.importLocalFirmware(
                uri = uri,
                chipType = chipType,
                nodeType = nodeType,
                version = "v-local",
                offsetHex = if (chipType == "esp32") "0x10000" else "0x000000"
            )
            Toast.makeText(requireContext(), "Importing local firmware...", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStep1FirmwareBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        observeViewModel()

        if (viewModel.firmwarePackages.value is Resource.Idle) {
            viewModel.fetchFirmwareManifest()
        }
    }

    private fun setupRecyclerView() {
        packageAdapter = FirmwarePackageAdapter(
            onSelect = { pkg ->
                viewModel.selectPackage(pkg)
            },
            onDownload = { pkg ->
                viewModel.downloadPackage(pkg)
            }
        )
        binding.recyclerViewPackages.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerViewPackages.adapter = packageAdapter
    }

    private fun setupListeners() {
        binding.btnFetchManifest.setOnClickListener {
            viewModel.fetchFirmwareManifest()
        }

        binding.btnImportSaf.setOnClickListener {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/octet-stream", "application/zip", "application/x-zip-compressed"))
            }
            safFilePickerLauncher.launch(intent)
        }

        binding.btnNextToConnect.setOnClickListener {
            (activity as? MainActivity)?.navigateToStep(2)
        }
    }

    private fun observeViewModel() {
        viewModel.firmwarePackages.observe(viewLifecycleOwner) { res ->
            when (res) {
                is Resource.Loading -> {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.tvStatusMessage.visibility = View.VISIBLE
                    binding.tvStatusMessage.text = res.progressMessage ?: "Loading packages..."
                }
                is Resource.Success -> {
                    binding.progressBar.visibility = View.GONE
                    binding.tvStatusMessage.visibility = View.GONE
                    packageAdapter.updateList(res.data, viewModel.selectedPackage.value?.id)
                }
                is Resource.Error -> {
                    binding.progressBar.visibility = View.GONE
                    binding.tvStatusMessage.visibility = View.VISIBLE
                    binding.tvStatusMessage.text = res.message
                    Toast.makeText(requireContext(), res.message, Toast.LENGTH_LONG).show()
                }
                is Resource.Idle -> {
                    binding.progressBar.visibility = View.GONE
                    binding.tvStatusMessage.visibility = View.GONE
                }
            }
        }

        viewModel.selectedPackage.observe(viewLifecycleOwner) { pkg ->
            if (pkg != null) {
                binding.layoutSelectedSummary.visibility = View.VISIBLE
                binding.tvSelectedSummary.text = "Selected: ${pkg.displayName} (${pkg.version})"
                packageAdapter.updateList(
                    (viewModel.firmwarePackages.value as? Resource.Success)?.data ?: emptyList(),
                    pkg.id
                )
            } else {
                binding.layoutSelectedSummary.visibility = View.GONE
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

