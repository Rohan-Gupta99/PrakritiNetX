package org.prakritinetx.fieldflash.ui.wizard

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import org.prakritinetx.fieldflash.R
import org.prakritinetx.fieldflash.core.Resource
import org.prakritinetx.fieldflash.databinding.FragmentStep5GeotagBinding
import org.prakritinetx.fieldflash.ui.MainActivity
import org.prakritinetx.fieldflash.ui.MainViewModel
import java.util.Locale

class Step5GeotagFragment : Fragment() {

    private var _binding: FragmentStep5GeotagBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MainViewModel by activityViewModels()

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineGranted || coarseGranted) {
            viewModel.acquireGpsLocation()
        } else {
            Toast.makeText(
                requireContext(),
                "Fine Location permission is required for accurate node geotagging.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStep5GeotagBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupListeners()
        observeViewModel()
        checkLocationPermissionAndAcquire()
    }

    private fun checkLocationPermissionAndAcquire() {
        val fineGranted = ContextCompat.checkSelfPermission(
            requireContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (fineGranted) {
            viewModel.acquireGpsLocation()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    private fun setupListeners() {
        binding.btnAcquireGps.setOnClickListener {
            checkLocationPermissionAndAcquire()
        }

        binding.btnConfirmDeployment.setOnClickListener {
            val writeToBoard = binding.switchWriteToBoard.isChecked
            val notes = binding.etSiteNotes.text?.toString()?.trim()
            viewModel.confirmDeploymentLocation(writeToBoard, notes)
        }

        binding.btnFinish.setOnClickListener {
            (activity as? MainActivity)?.navigateToStep(1)
        }
    }

    private fun observeViewModel() {
        val pkg = viewModel.selectedPackage.value
        val nodeId = viewModel.detectedNodeId.value?.takeIf { it.isNotBlank() } ?: "Unknown"
        val chip = viewModel.detectedChip.value ?: (pkg?.chipType?.uppercase() ?: "Unknown")
        val ver = pkg?.version ?: "v1.0.0"

        binding.tvNodeMetadata.text = "Hardware Node ID: $nodeId\nFirmware Version: $ver\nTarget Silicon: $chip"

        viewModel.gpsFix.observe(viewLifecycleOwner) { res ->
            when (res) {
                is Resource.Loading -> {
                    binding.pbGps.visibility = View.VISIBLE
                    binding.tvGpsCoordinates.text = "Acquiring GPS fix from satellites...\nPlease ensure outdoor visibility."
                    binding.btnConfirmDeployment.isEnabled = false
                }
                is Resource.Success -> {
                    binding.pbGps.visibility = View.GONE
                    val fix = res.data
                    val altStr = fix.altitude?.let { "${String.format(Locale.US, "%.1f", it)} m" } ?: "N/A"
                    val accStr = fix.accuracy?.let { "±${String.format(Locale.US, "%.1f", it)} m" } ?: "N/A"
                    binding.tvGpsCoordinates.text = String.format(
                        Locale.US,
                        "Latitude: %.6f°\nLongitude: %.6f°\nAltitude: %s | Accuracy: %s",
                        fix.latitude,
                        fix.longitude,
                        altStr,
                        accStr
                    )
                    binding.btnConfirmDeployment.isEnabled = true
                }
                is Resource.Error -> {
                    binding.pbGps.visibility = View.GONE
                    binding.tvGpsCoordinates.text = "GPS Error: ${res.message}"
                    binding.btnConfirmDeployment.isEnabled = false
                }
                is Resource.Idle -> {
                    binding.pbGps.visibility = View.GONE
                    binding.btnConfirmDeployment.isEnabled = false
                }
            }
        }

        viewModel.geotagResult.observe(viewLifecycleOwner) { res ->
            when (res) {
                is Resource.Loading -> {
                    binding.btnConfirmDeployment.isEnabled = false
                    binding.tvGeotagFeedback.visibility = View.VISIBLE
                    binding.tvGeotagFeedback.text = "Saving & registering deployment location..."
                    binding.tvGeotagFeedback.setTextColor(requireContext().getColor(R.color.brand_secondary))
                }
                is Resource.Success -> {
                    binding.btnConfirmDeployment.isEnabled = false
                    binding.tvGeotagFeedback.visibility = View.VISIBLE
                    binding.tvGeotagFeedback.text = "✓ " + res.data
                    binding.tvGeotagFeedback.setTextColor(requireContext().getColor(R.color.status_success))
                    binding.btnFinish.visibility = View.VISIBLE
                }
                is Resource.Error -> {
                    binding.btnConfirmDeployment.isEnabled = true
                    binding.tvGeotagFeedback.visibility = View.VISIBLE
                    binding.tvGeotagFeedback.text = "Error: " + res.message
                    binding.tvGeotagFeedback.setTextColor(requireContext().getColor(R.color.status_error))
                }
                is Resource.Idle -> {
                    binding.tvGeotagFeedback.visibility = View.GONE
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

